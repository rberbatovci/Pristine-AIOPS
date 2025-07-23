from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.devices import models, schemas
from app.devices.services import configureDevice, syslogXEPlaybook, trapsXEPlaybook, netflowXEPlaybook, cpuUtilXEPlaybook, configureSyslogsXR, memStatsXEPlaybook, interfaceStatsXEPlaybook, BGPConnectionsXEPlaybook
import asyncio
router = APIRouter()
import os

@router.get("/devices/", response_model=List[dict])
async def get_device_ids_names(db: AsyncSession = Depends(get_db)):
    """
    Retrieve a list of device IDs and hostnames.
    """
    result = await db.execute(
        select(
            models.Device.id,
            models.Device.hostname,
            models.Device.ip_address,
            models.Device.vendor,
            models.Device.version,
            models.Device.features
        )
    )

    devices = result.all()
    return [
        {
            "id": id,
            "hostname": hostname,
            "ip_address": ip_address,
            "vendor": vendor,
            "version": version,
            "features": features
        }
        for id, hostname, ip_address, vendor, version, features in devices
    ]

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
    "cpu_util": cpuUtilXEPlaybook,
    "memory_stats": memStatsXEPlaybook,
    "interface_stats": interfaceStatsXEPlaybook,
    "bgp_connections": BGPConnectionsXEPlaybook
}

@router.post("/devices/", response_model=schemas.DeviceResponse, status_code=201)
async def create_device(device_in: schemas.DeviceCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(models.Device).where(models.Device.hostname == device_in.hostname)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Device with this hostname already exists")

    device_data = device_in.model_dump()

    # Force only the wanted keys (ip_address, hostname, vendor, version)
    filtered_data = {
        "ip_address": device_data.get("ip_address"),
        "hostname": device_data.get("hostname"),
        "vendor": device_data.get("vendor"),
        "version": device_data.get("version"),
    }

    # Set features to default all-false dict
    filtered_data["features"] = default_features

    db_device = models.Device(**filtered_data)
    db.add(db_device)
    await db.commit()
    await db.refresh(db_device)

    return db_device

@router.post("/devices/{hostname}/syslogs-xe-config/", response_model=schemas.DeviceResponse)
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

    # Correct way to update JSONB field:
    features = device.features or {}
    features["syslogs"] = True
    device.features = features  # <-- re-assign to trigger update detection

    db.add(device)
    await db.commit()
    await db.refresh(device)

    return device

@router.post("/devices/{hostname}/xe/configure/{feature_name}/", response_model=schemas.DeviceResponse)
async def configure_telemetry_feature(
    hostname: str,
    feature_name: str,
    config: schemas.CPUTelemetryConfig,
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

    # Run Ansible playbook
    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=playbook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": ssh_username,
            "password": syslog_port,
            "receiver_host": receiver_host,
            "receiver_port": receiver_port
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

@router.post("/devices/{hostname}/traps-xe-config/", response_model=schemas.DeviceResponse)
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

@router.post("/devices/{hostname}/netflow-xe-config/", response_model=schemas.DeviceResponse)
async def configure_netflow(
    hostname: str,
    config: schemas.NetflowConfig,
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

@router.post("/devices/{hostname}/syslog-xr-config/", response_model=schemas.DeviceResponse)
async def configure_syslogs_xr(
    hostname: str,
    config: schemas.SyslogConfig,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    device = result.scalars().first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    ansible_result = await configureSyslogsXR(
        router_ip=device.ip_address,
        severity=config.severity
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    return device

@router.get("/devices/{hostname}", response_model=schemas.DeviceResponse)
async def get_device_by_hostname(hostname: str, db: AsyncSession = Depends(get_db)):
    """
    Get a device by its hostname.
    """
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    db_device = result.scalars().first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    return db_device

@router.delete("/devices/{hostname}", status_code=204)
async def delete_device(hostname: str, db: AsyncSession = Depends(get_db)):
    """
    Delete a device by its hostname.
    """
    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    db_device = result.scalars().first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")
    await db.delete(db_device)
    await db.commit()
    return