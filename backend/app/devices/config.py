import os
from fastapi import APIRouter, HTTPException, Depends
from app.devices import schemas
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # Points to app/devices
syslogXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-syslogs.yml')
trapsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-snmptraps.yml')
netflowXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-netflow.yml')
syslogXRPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xr-syslogs.yml')
cpuUtilXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-cpu-util.yml')
memStatsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-memory-stats.yml')
interfaceStatsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-interface-stats.yml')
BGPConnectionsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-bgp-connections.yml')
ribTablePlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'rib-table.yml')
fibEntryPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'fib-entry.yml')
ISISStatsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-isis-statistics.yml')
syslogXRPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xr-syslogs.yml')

default_features = {
    "syslogs": False,
    "snmp_traps": False,
    "netflow": False,
    "telemetry": {
        "cpu_util": False,
        "memory_stats": False,
        "interface_stats": False
    }
}

telemetry_playbook_map = {
    "syslogs": syslogXEPlaybook,
    "snmp_traps": trapsXEPlaybook,
    "netflow": netflowXEPlaybook,
    "cpu_util": cpuUtilXEPlaybook,
    "memory_stats": memStatsXEPlaybook,
    "interface_stats": interfaceStatsXEPlaybook,
    "bgp_connections": BGPConnectionsXEPlaybook,
    "rib_table": ribTablePlaybook,
    "fib_entry": fibEntryPlaybook
}

telemetry_playbook_map = {
    "syslogs": syslogXEPlaybook,
    "snmp_traps": trapsXEPlaybook,
    "netflow": netflowXEPlaybook,
    "cpu_util": cpuUtilXEPlaybook,
    "memory_stats": memStatsXEPlaybook,
    "interface_stats": interfaceStatsXEPlaybook,
    "bgp_connections": BGPConnectionsXEPlaybook,
    "rib_table": ribTablePlaybook,
    "fib_entry": fibEntryPlaybook
}

@router.post("/devices/{hostname}/configure/{feature_name}/", response_model=schemas.DeviceResponse)
async def configure_telemetry_feature(
    hostname: str,
    feature_name: str,
    db: AsyncSession = Depends(get_db)
):
    # Validate supported telemetry feature
    playbook = telemetry_playbook_map.get(feature_name)
    if not playbook:
        raise HTTPException(status_code=400, detail=f"Unsupported telemetry feature: {feature_name}")

    # Fetch device
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    device = result.scalars().first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    receiver_host = os.getenv("RECEIVING_ADDRESS")
    receiver_port = os.getenv("TELEMETRY_PORT")
    ssh_username = os.getenv("SSH_USERNAME")
    ssh_password = os.getenv("SSH_PASSWORD")
    telemetry_period_seconds = os.getenv("TELEMETRY_PERIOD_SECONDS", "3000")  # Default to 3000 seconds if not set

    # Validate all required variables
    missing_vars = []
    if not receiver_host:
        missing_vars.append("RECEIVING_ADDRESS")
    if not receiver_port:
        missing_vars.append("TELEMETRY_PORT")
    if not ssh_username:
        missing_vars.append("SSH_USERNAME")
    if not ssh_password:
        missing_vars.append("SSH_PASSWORD")
    if not telemetry_period_seconds:
        missing_vars.append("TELEMETRY_PERIOD_SECONDS")

    if missing_vars:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required environment variables: {', '.join(missing_vars)}"
        )

    # Run Ansible playbook
    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=playbook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": ssh_username,
            "password": ssh_password,
            "receiver_ip": receiver_host,
            "receiver_port": receiver_port,
            "telemetry_period_seconds": telemetry_period_seconds,
        }
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    # Safely update telemetry feature flag
    if device.features is None:
        device.features = {}

    telemetry = device.features.get("telemetry", {}) or {}
    telemetry[feature_name] = True
    device.features["telemetry"] = telemetry

    db.add(device)
    await db.commit()
    await db.refresh(device)

    return device


@router.post("/devices/{hostname}/config/2/syslogs/", response_model=schemas.DeviceResponse)
async def configure_syslogs(
    hostname: str,
    config: schemas.SyslogConfig,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    syslog_host = os.getenv("RECEIVING_ADDRESS")
    syslog_port = os.getenv("SYSLOG_PORT")
    ssh_username = os.getenv("SSH_USERNAME")
    ssh_password = os.getenv("SSH_PASSWORD")
    syslog_severity = os.getenv("SYSLOG_SEVERITY", "notifications")

    # Validate all required variables
    missing_vars = []
    if not syslog_host:
        missing_vars.append("RECEIVING_ADDRESS")
    if not syslog_port:
        missing_vars.append("SYSLOG_PORT")
    if not ssh_username:
        missing_vars.append("SSH_USERNAME")
    if not ssh_password:
        missing_vars.append("SSH_PASSWORD")
    if not syslog_severity:
        missing_vars.append("SYSLOG_SEVERITY")

    if missing_vars:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required environment variables: {', '.join(missing_vars)}"
        )

    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=syslogXEPlaybook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": ssh_username,
            "password": ssh_password,
            "syslog_host": syslog_host,
            "syslog_port": syslog_port,
            "syslog_severity": syslog_severity
        }
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    features = device.features or {}
    features["syslogs"] = True
    device.features = features

    db.add(device)
    await db.commit()
    await db.refresh(device)

    return device

@router.post("/devices/{hostname}/config/2/traps/", response_model=schemas.DeviceResponse)
async def configure_snmp_traps(
    hostname: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    receiver_host = os.getenv("RECEIVING_ADDRESS")
    receiver_port = os.getenv("SNMP_TRAP_PORT")
    ssh_username = os.getenv("SSH_USERNAME")
    ssh_password = os.getenv("SSH_PASSWORD")
    snmpv3_username = os.getenv("SNMP_USERNAME")
    snmpv3_engineId = os.getenv("SNMP_ENGINE_ID")
    snmpv3_priv_password = os.getenv("SNMP_PRIV_PASS")
    snmpv3_auth_password = os.getenv("SNMP_AUTH_PASS")

    # Validate all required variables
    missing_vars = []
    if not receiver_host:
        missing_vars.append("RECEIVING_ADDRESS")
    if not receiver_port:
        missing_vars.append("TELEMETRY_PORT")
    if not ssh_username:
        missing_vars.append("SSH_USERNAME")
    if not ssh_password:
        missing_vars.append("SSH_PASSWORD")
    if not snmpv3_username:
        missing_vars.append("SNMP_USERNAME")
    if not snmpv3_engineId:
        missing_vars.append("SNMP_ENGINE_ID")
    if not snmpv3_priv_password:
        missing_vars.append("SNMP_PRIV_PASS")
    if not snmpv3_auth_password:
        missing_vars.append("SNMP_AUTH_PASS")

    if missing_vars:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required environment variables: {', '.join(missing_vars)}"
        )


    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=trapsXEPlaybook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": ssh_username,
            "password": ssh_password,
            "snmp_trap_host": receiver_host,
            "snmp_trap_port": receiver_port,
            "snmp_user": snmpv3_username,
            "snmp_auth_pass": snmpv3_auth_password,
            "snmp_priv_pass": snmpv3_priv_password,
            "snmp_engine_id": snmpv3_engineId
        }
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    # Safely update features dict and reassign
    features = device.features or {}
    features["snmp_traps"] = True
    device.features = features  # re-assign so SQLAlchemy detects change

    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device

@router.post("/devices/{hostname}/config/2/netflow/", response_model=schemas.DeviceResponse)
async def configure_netflow(
    hostname: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")


    receiver_host = os.getenv("RECEIVING_ADDRESS")
    receiver_port = os.getenv("NETFLOW_PORT")
    ssh_username = os.getenv("SSH_USERNAME")
    ssh_password = os.getenv("SSH_PASSWORD")

    # Validate all required variables
    missing_vars = []
    if not receiver_host:
        missing_vars.append("RECEIVING_ADDRESS")
    if not receiver_port:
        missing_vars.append("TELEMETRY_PORT")
    if not ssh_username:
        missing_vars.append("SSH_USERNAME")
    if not ssh_password:
        missing_vars.append("SSH_PASSWORD")


    if missing_vars:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required environment variables: {', '.join(missing_vars)}"
        )


    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=netflowXEPlaybook,
        extra_vars={
            "router_ip": device.ip_address,
            "receiver_host": receiver_host,
            "receiver_port": receiver_port,
            "username": ssh_username,
            "password": ssh_password,
            "netflow_interfaces": [
                "GigabitEthernet1",
                "GigabitEthernet2",
                "GigabitEthernet3",
                "Loopback0"
            ]
        }
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    # Update netflow feature flag after successful config
    features = device.features or {}
    features["netflow"] = True
    device.features = features  # Re-assign to trigger change detection

    db.add(device)
    await db.commit()
    await db.refresh(device)

    return device

