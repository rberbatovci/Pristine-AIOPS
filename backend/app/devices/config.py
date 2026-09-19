import os
import json
import asyncio
import subprocess

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.devices import models, schemas
from app.db.session import get_db
from app.auth.keycloak import require_admin


router = APIRouter(
    prefix="/api/devices",
    tags=["devices"],
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# app/devices/../ansible
ANSIBLE_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "..", "ansible")
)


# ============================================================
# DEFAULT FEATURES
# ============================================================

default_features = {
    "syslogs": False,
    "snmp_traps": False,
    "netflow": False,
    "telemetry": False,
    "telemetry_features": {
        "system_util": False,
        "interface_stats": False,
    },
}


# ============================================================
# ANSIBLE PLAYBOOK MAP
#
# Structure:
#
# ansible/
# └── cisco/
#     ├── ios-xe/
#     ├── ios-xr/
#     └── nx-os/
#
# ============================================================

CISCO_PLAYBOOK_MAP = {

    "ios-xe": {
        "syslogs": "syslogs.yml",
        "snmp_traps": "snmptraps.yml",
        "netflow": "netflow.yml",

        "system_util": "system-util.yml",
        "isis_stats": "isis-statistics.yml",
        "ospf_stats": "ospf-statistics.yml",
        "lldp_stats": "lldp-statistics.yml",
        "interface_stats": "interface-stats.yml",
        "bgp_connections": "bgp-connections.yml",

        "rib_table": "rib-table.yml",
        "fib_entry": "fib-entry.yml",

        "telemetry": "telemetry.yml",
        "bgp-link-state": "bgp-link-state.yml",

        "aaa-radius": "aaa-radius.yml",
    },

    "ios-xr": {
        "syslogs": "syslogs.yml",
        "snmp_traps": "snmptraps.yml",
        "netflow": "netflow.yml",

        "system_util": "system-util.yml",
        "isis_stats": "isis-statistics.yml",
        "ospf_stats": "ospf-statistics.yml",
        "lldp_stats": "lldp-statistics.yml",
        "interface_stats": "interface-stats.yml",
        "bgp_connections": "bgp-connections.yml",

        "rib_table": "rib-table.yml",
        "fib_entry": "fib-entry.yml",

        "telemetry": "telemetry.yml",
        "bgp-link-state": "bgp-link-state.yml",

        "aaa-radius": "aaa-radius.yml",
    },

    "nx-os": {
        "syslogs": "syslogs.yml",
        "snmp_traps": "snmptraps.yml",
        "netflow": "netflow.yml",

        "system_util": "system-util.yml",
        "isis_stats": "isis-statistics.yml",
        "ospf_stats": "ospf-statistics.yml",
        "lldp_stats": "lldp-statistics.yml",
        "interface_stats": "interface-stats.yml",
        "bgp_connections": "bgp-connections.yml",

        "rib_table": "rib-table.yml",
        "fib_entry": "fib-entry.yml",

        "telemetry": "telemetry.yml",
        "bgp-link-state": "bgp-link-state.yml",

        "aaa-radius": "aaa-radius.yml",
    },
}


# ============================================================
# NORMALIZE VENDOR
# ============================================================

def normalize_vendor(vendor: str | None) -> str:
    """
    Normalize vendor names stored in the database.

    Examples:

        Cisco
        CISCO
        cisco
        Cisco Systems

    all become:

        cisco
    """

    if not vendor:
        return ""

    return vendor.strip().lower()


# ============================================================
# NORMALIZE VERSION / PLATFORM
# ============================================================

def normalize_platform(version: str | None) -> str:
    """
    Determine Cisco platform from the Device.version field.

    Supported examples:

        IOS-XE
        IOS XE
        IOS-XE 17.9

        IOS XR
        IOS-XR 7.8

        NX-OS
        NXOS
        NX-OS 10.2

    Returns:

        ios-xe
        ios-xr
        nx-os
    """

    if not version:
        return ""

    value = version.strip().lower()

    # --------------------------------------------------------
    # IOS XE
    # --------------------------------------------------------

    if (
        "ios-xe" in value
        or "ios xe" in value
        or value.startswith("iosxe")
        or value == "xe"
    ):
        return "ios-xe"

    # --------------------------------------------------------
    # IOS XR
    # --------------------------------------------------------

    if (
        "ios-xr" in value
        or "ios xr" in value
        or value.startswith("iosxr")
        or value == "xr"
    ):
        return "ios-xr"

    # --------------------------------------------------------
    # NX-OS
    # --------------------------------------------------------

    if (
        "nx-os" in value
        or "nx os" in value
        or value.startswith("nxos")
        or value == "nx"
    ):
        return "nx-os"

    return ""


# ============================================================
# RESOLVE PLAYBOOK
# ============================================================

def get_playbook(
    vendor: str | None,
    version: str | None,
    feature_name: str,
) -> str:
    """
    Resolve the correct Ansible playbook based on:

        vendor
        version/platform
        feature

    Example:

        vendor = Cisco
        version = IOS-XE 17.9
        feature = netflow

    returns:

        /app/app/ansible/cisco/ios-xe/netflow.yml
    """

    normalized_vendor = normalize_vendor(vendor)

    # --------------------------------------------------------
    # Vendor
    # --------------------------------------------------------

    if normalized_vendor != "cisco":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported vendor: {vendor}",
        )

    # --------------------------------------------------------
    # Platform
    # --------------------------------------------------------

    platform = normalize_platform(version)

    if not platform:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported Cisco platform/version: {version}. "
                f"Expected IOS-XE, IOS-XR or NX-OS."
            ),
        )

    # --------------------------------------------------------
    # Platform playbooks
    # --------------------------------------------------------

    platform_playbooks = CISCO_PLAYBOOK_MAP.get(platform)

    if not platform_playbooks:
        raise HTTPException(
            status_code=400,
            detail=f"No playbook configuration for platform: {platform}",
        )

    # --------------------------------------------------------
    # Feature playbook
    # --------------------------------------------------------

    playbook_filename = platform_playbooks.get(feature_name)

    if not playbook_filename:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Feature '{feature_name}' is not supported "
                f"on Cisco {platform}."
            ),
        )

    # --------------------------------------------------------
    # Build playbook path
    # --------------------------------------------------------

    playbook_path = os.path.join(
        ANSIBLE_DIR,
        "cisco",
        platform,
        playbook_filename,
    )

    # --------------------------------------------------------
    # Security / configuration sanity check
    # --------------------------------------------------------

    if not os.path.isfile(playbook_path):
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Ansible playbook not found",
                "vendor": vendor,
                "version": version,
                "platform": platform,
                "feature": feature_name,
                "playbook": playbook_path,
            },
        )

    return playbook_path


# ============================================================
# RUN ANSIBLE
# ============================================================

async def configureDevice(
    router_ip: str,
    playbook: str,
    extra_vars: dict,
    platform: str | None = None,
):
    cmd = [
        "ansible-playbook",
        playbook,
        "-i",
        f"{router_ip},",
        "--extra-vars",
        json.dumps(extra_vars),
    ]

    env = os.environ.copy()
    env["ANSIBLE_HOST_KEY_CHECKING"] = "False"

    if platform == "nx-os":
        # Force libssh environment overrides for legacy algorithms
        env["ANSIBLE_NETWORK_CLI_SSH_TYPE"] = "libssh"
        env["ANSIBLE_LIBSSH_HOSTKEYS"] = "+ssh-rsa"
        env["ANSIBLE_LIBSSH_MACS"] = "+hmac-sha1"
        env["ANSIBLE_LIBSSH_KEY_EXCHANGE_ALGORITHMS"] = "+diffie-hellman-group14-sha1"

    def run_ansible():
        return subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
        )

    process = await asyncio.to_thread(run_ansible)
    return {
        "stdout": process.stdout,
        "stderr": process.stderr,
        "returncode": process.returncode,
    }


# ============================================================
# CONFIGURE DEVICE FEATURE
# ============================================================

@router.post(
    "/{hostname}/configure/{feature_name}/",
    response_model=schemas.DeviceResponse,
)
async def configure_telemetry_feature(
    hostname: str,
    feature_name: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_admin),
):

    # ========================================================
    # FIND DEVICE
    # ========================================================

    result = await db.execute(
        select(models.Device).where(
            models.Device.hostname == hostname
        )
    )

    device = result.scalars().first()

    if not device:
        raise HTTPException(
            status_code=404,
            detail="Device not found",
        )

    # ========================================================
    # RESOLVE PLATFORM
    # ========================================================

    platform = normalize_platform(device.version)

    # ========================================================
    # RESOLVE PLAYBOOK
    # ========================================================

    playbook = get_playbook(
        vendor=device.vendor,
        version=device.version,
        feature_name=feature_name,
    )

    # ========================================================
    # ENSURE FEATURE CONTAINER EXISTS
    # ========================================================

    if device.features is None:
        device.features = default_features.copy()

    # ========================================================
    # BASE ANSIBLE VARIABLES
    # ========================================================

    vars = {
        "router_ip": device.ip_address,
        "username": os.getenv("SSH_USERNAME"),
        "password": os.getenv("SSH_PASSWORD"),
        "receiver_ip": os.getenv("RECEIVING_ADDRESS"),
    }

    # ========================================================
    # PLATFORM-SPECIFIC ANSIBLE VARIABLES
    # ========================================================

    if platform == "nx-os":
        vars.update({
            "ansible_network_cli_ssh_type": "libssh",
            "ansible_libssh_hostkeys": "+ssh-rsa",
            "ansible_libssh_macs": "+hmac-sha1",
            "ansible_libssh_kex": "+diffie-hellman-group14-sha1",
        })

    # ========================================================
    # SYSLOG
    # ========================================================

    if feature_name == "syslogs":

        vars.update({
            "receiver_port": os.getenv("SYSLOG_PORT"),
            "syslog_severity": os.getenv(
                "SYSLOG_SEVERITY",
                "informational",
            ),
        })

    # ========================================================
    # SNMP TRAPS
    # ========================================================

    elif feature_name == "snmp_traps":

        vars.update({
            "receiver_port": os.getenv("SNMP_TRAP_PORT"),
            "snmp_user": os.getenv("SNMP_USERNAME"),
            "snmp_engine_id": os.getenv("SNMP_ENGINE_ID"),
            "snmp_priv_pass": os.getenv("SNMP_PRIV_PASS"),
            "snmp_auth_pass": os.getenv("SNMP_AUTH_PASS"),
        })

    # ========================================================
    # NETFLOW
    # ========================================================

    elif feature_name == "netflow":

        vars.update({
            "receiver_port": os.getenv("NETFLOW_PORT"),
        })

    # ========================================================
    # TELEMETRY
    # ========================================================

    elif feature_name == "telemetry":

        vars.update({
            "receiver_port": os.getenv("TELEMETRY_PORT"),
            "telemetry_period_seconds": os.getenv(
                "TELEMETRY_PERIOD_SECONDS",
                "3000",
            ),
        })

    # ========================================================
    # BGP LINK STATE
    # ========================================================

    elif feature_name == "bgp-link-state":

        vars.update({
            "isis_instance": os.getenv(
                "ISIS_INSTANCE_NAME"
            ),

            "bgp_asn": os.getenv(
                "BGP_AS_NUMBER",
                "500",
            ),

            "bgp_neighbor_ip": os.getenv(
                "BGP_ROUTER_ID"
            ),

            "bgp_neighbor_asn": os.getenv(
                "BGP_NEIGHBOR_AS",
                "500",
            ),

            "bgp_source_interface": os.getenv(
                "BGP_SOURCE_INTERFACE",
                "Loopback0",
            ),
        })

    # ========================================================
    # AAA / RADIUS
    # ========================================================

    elif feature_name == "aaa-radius":

        vars.update({
            "radius_server_ip": os.getenv(
                "DOMAIN_CONTROLLER_ADDRESS"
            ),

            "radius_key": os.getenv(
                "RADIUS_KEY"
            ),
        })

    # ========================================================
    # UNKNOWN FEATURE
    # ========================================================

    elif feature_name not in {
        "system_util",
        "isis_stats",
        "ospf_stats",
        "lldp_stats",
        "interface_stats",
        "bgp_connections",
        "rib_table",
        "fib_entry",
    }:

        raise HTTPException(
            status_code=400,
            detail=f"Unsupported feature: {feature_name}",
        )

    # ========================================================
    # LOG CONFIGURATION
    # ========================================================

    print("=" * 70)
    print("DEVICE FEATURE CONFIGURATION")
    print("=" * 70)

    print(f"Hostname : {device.hostname}")
    print(f"IP       : {device.ip_address}")
    print(f"Vendor   : {device.vendor}")
    print(f"Version  : {device.version}")
    print(f"Platform : {platform}")
    print(f"Feature  : {feature_name}")
    print(f"Playbook : {playbook}")

    print("=" * 70)

    # ========================================================
    # RUN ANSIBLE
    # ========================================================

    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=playbook,
        extra_vars=vars,
        platform=platform,
    )

    # ========================================================
    # ANSIBLE FAILURE
    # ========================================================

    if ansible_result["returncode"] != 0:

        # IMPORTANT:
        # Do not enable/persist the feature if Ansible failed.

        raise HTTPException(
            status_code=500,
            detail={
                "error": "Ansible playbook failed",
                "playbook": playbook,
                "platform": platform,
                "stderr": ansible_result["stderr"],
                "output": ansible_result["stdout"],
            },
        )

    # ========================================================
    # UPDATE FEATURE STATE ONLY AFTER SUCCESS
    # ========================================================

    if feature_name == "syslogs":

        device.features["syslogs"] = True

    elif feature_name == "snmp_traps":

        device.features["snmp_traps"] = True

    elif feature_name == "netflow":

        device.features["netflow"] = True

    elif feature_name == "telemetry":

        # Ensure telemetry structure exists

        if device.features.get("telemetry") is None:

            device.features["telemetry"] = {
                "enabled": False,
                "features": {},
            }

        if (
            "features" not in device.features["telemetry"]
            or device.features["telemetry"]["features"] is None
        ):
            device.features["telemetry"]["features"] = {}

        # Enable telemetry

        device.features["telemetry"]["enabled"] = True

        tf = device.features["telemetry"]["features"]

        tf["cpu_util"] = True
        tf["memory_util"] = True
        tf["system_util"] = True
        tf["interface_stats"] = True

    elif feature_name == "bgp-link-state":

        device.features["bgp-link-state"] = True

    elif feature_name == "aaa-radius":

        device.features["aaa-radius"] = True

    # ========================================================
    # GENERIC TELEMETRY FEATURES
    # ========================================================

    elif feature_name in {
        "system_util",
        "isis_stats",
        "ospf_stats",
        "lldp_stats",
        "interface_stats",
        "bgp_connections",
        "rib_table",
        "fib_entry",
    }:

        if device.features.get("telemetry") is None:

            device.features["telemetry"] = {
                "enabled": True,
                "features": {},
            }

        if (
            "features" not in device.features["telemetry"]
            or device.features["telemetry"]["features"] is None
        ):
            device.features["telemetry"]["features"] = {}

        device.features["telemetry"]["features"][feature_name] = True

    # ========================================================
    # TELL SQLALCHEMY JSONB WAS MODIFIED
    # ========================================================

    flag_modified(
        device,
        "features",
    )

    # ========================================================
    # PERSIST SUCCESSFUL CONFIGURATION
    # ========================================================

    db.add(device)

    await db.commit()

    await db.refresh(device)

    # ========================================================
    # RETURN DEVICE
    # ========================================================

    return device 