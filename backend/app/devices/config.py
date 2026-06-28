import os
from fastapi import APIRouter, HTTPException, Depends, status
from app.devices import models, schemas
from app.db.session import get_db
from app.auth.keycloak import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import subprocess
from app.auth.keycloak import require_admin

router = APIRouter(
    prefix="/api/devices",
    tags=["devices"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # Points to app/devices

default_features = {
    "syslogs": False,
    "snmp_traps": False,
    "netflow": False,
    "telemetry": False,
    "telemetry_features": {
        "system_util": False,
        "interface_stats": False
    }
}

telemetry_playbook_map = {
    "syslogs": os.path.join(BASE_DIR, '..', 'ansible', 'xe-syslogs.yml'),
    "snmp_traps": os.path.join(BASE_DIR, '..', 'ansible', 'xe-snmptraps.yml'),
    "netflow": os.path.join(BASE_DIR, '..', 'ansible', 'xe-netflow.yml'),
    "system_util": os.path.join(BASE_DIR, '..', 'ansible', 'xe-system-util.yml'),
    "isis_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-isis-statistics.yml'),
    "ospf_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-ospf-statistics.yml'),
    "lldp_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-lldp-statistics.yml'),
    "interface_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-interface-stats.yml'),
    "bgp_connections": os.path.join(BASE_DIR, '..', 'ansible', 'xe-bgp-connections.yml'),
    "rib_table": os.path.join(BASE_DIR, '..', 'ansible', 'rib-table.yml'),
    "fib_entry": os.path.join(BASE_DIR, '..', 'ansible', 'fib-entry.yml'),
    "telemetry": os.path.join(BASE_DIR, '..', 'ansible', 'xe-telemetry.yml'),
    "bgp-link-state": os.path.join(BASE_DIR, '..', 'ansible', 'xe-bgp-link-state.yml'),
    "aaa-radius": os.path.join(BASE_DIR, '..', 'ansible', 'xe-aaa-radius.yml'),
}

async def configureDevice(router_ip: str, playbook: str, extra_vars: dict):
    cmd = [
        "ansible-playbook",
        playbook,
        "-i", f"{router_ip},",
        "--extra-vars", json.dumps(extra_vars)
    ]

    env = os.environ.copy()
    env["ANSIBLE_HOST_KEY_CHECKING"] = "False"

    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)

    print(f"Ansible stdout:\n{process.stdout}")
    print(f"Ansible stderr:\n{process.stderr}")
    print(f"Ansible returncode: {process.returncode}")

    return {
        "stdout": process.stdout,
        "stderr": process.stderr,
        "returncode": process.returncode
    }

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
    playbook = telemetry_playbook_map.get(feature_name)
    if not playbook:
        raise HTTPException(status_code=400, detail="Unsupported telemetry feature")

    result = await db.execute(
        select(models.Device).where(models.Device.hostname == hostname)
    )
    device = result.scalars().first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # ---------------------------
    # Ensure feature container exists
    # ---------------------------
    if device.features is None:
        device.features = schemas.DeviceFeatures()

    # ---------------------------
    # Base ansible vars
    # ---------------------------
    vars = {
        "router_ip": device.ip_address,
        "username": os.getenv("SSH_USERNAME"),
        "password": os.getenv("SSH_PASSWORD"),
        "receiver_ip": os.getenv("RECEIVING_ADDRESS"),
    }

    # ---------------------------
    # Feature handling (Dictionary bracket/get notation)
    # ---------------------------
    if feature_name == "syslogs":
        vars.update({
            "receiver_port": os.getenv("SYSLOG_PORT"),
            "syslog_severity": os.getenv("SYSLOG_SEVERITY", "informational"),
        })
        device.features["syslogs"] = True

    elif feature_name == "snmp_traps":
        vars.update({
            "receiver_port": os.getenv("SNMP_TRAP_PORT"),
            "snmp_user": os.getenv("SNMP_USERNAME"),
            "snmp_engine_id": os.getenv("SNMP_ENGINE_ID"),
            "snmp_priv_pass": os.getenv("SNMP_PRIV_PASS"),
            "snmp_auth_pass": os.getenv("SNMP_AUTH_PASS"),
        })
        device.features["snmp_traps"] = True

    elif feature_name == "netflow":
        vars.update({
            "receiver_port": os.getenv("NETFLOW_PORT"),
        })
        device.features["netflow"] = True

    elif feature_name == "telemetry":
        vars.update({
            "receiver_port": os.getenv("TELEMETRY_PORT"),
            "telemetry_period_seconds": os.getenv("TELEMETRY_PERIOD_SECONDS", "3000"),
        })

        # Ensure nested dictionary structures exist safely
        if device.features.get("telemetry") is None:
            device.features["telemetry"] = {"enabled": False, "features": {}}
    
        # If it is an existing dict but missing the nested 'features' key
        if "features" not in device.features["telemetry"] or device.features["telemetry"]["features"] is None:
            device.features["telemetry"]["features"] = {}

        # Enable telemetry block + modify features
        device.features["telemetry"]["enabled"] = True
    
        tf = device.features["telemetry"]["features"]
        tf["cpu_util"] = True
        tf["memory_util"] = True
        tf["system_util"] = True
        tf["interface_stats"] = True
    elif feature_name == "bgp-link-state":
        vars.update({
            "isis_instance": os.getenv("ISIS_INSTANCE_NAME"),
            "bgp_asn": os.getenv("BGP_AS_NUMBER", "500"),
            "bgp_neighbor_ip": os.getenv("BGP_NEIGHBOR_IP"),
            "bgp_neighbor_asn": os.getenv("BGP_NEIGHBOR_AS", "500"),
            "bgp_source_interface": os.getenv("BGP_SOURCE_INTERFACE", "Loopback0"),
        })
        device.features["bgp-link-state"] = True
    elif feature_name == "aaa-radius":
        vars.update({
            "radius_server_ip": os.getenv("DOMAIN_CONTROLLER_ADDRESS"),
            "radius_key": os.getenv("ISIS_INSTANCE_NAME"),
        })
        device.features["telemetry"] = True
    else:
        raise HTTPException(status_code=400, detail="Unsupported feature")

    # Explicitly flag modification to SQLAlchemy if you notice updates aren't tracking
    # (Though MutableDict usually listens for inside mutations automatically)
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(device, "features")

    # ---------------------------
    # Run ansible
    # ---------------------------
    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=playbook,
        extra_vars=vars,
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"],
            },
        )

    # ---------------------------
    # persist
    # ---------------------------
    db.add(device)
    await db.commit()
    await db.refresh(device)

    return device