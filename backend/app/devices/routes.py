from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.devices import models, schemas
from app.devices.services import configureDevice, syslogXEPlaybook, trapsXEPlaybook, netflowXEPlaybook, configureSyslogsXR
import asyncio
router = APIRouter()

@router.get("/devices/", response_model=List[dict])
async def get_device_ids_names(db: AsyncSession = Depends(get_db)):
    """
    Retrieve a list of device IDs and hostnames.
    """
    result = await db.execute(select(models.Device.id, models.Device.hostname))
    devices = result.all()
    return [{"id": id, "hostname": hostname} for id, hostname in devices]


@router.post("/devices/", response_model=schemas.DeviceResponse, status_code=201)
async def create_device(device_in: schemas.DeviceCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(models.Device).where(models.Device.hostname == device_in.hostname)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Device with this hostname already exists")

    db_device = models.Device(**device_in.model_dump())
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

    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=syslogXEPlaybook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": "admin",
            "password": "cisco123",
            "syslog_host": "192.168.1.191",
            "syslog_port": "1160",
            "syslog_severity": config.severity
        }
    )

    if ansible_result["returncode"] != 0:
        # Do NOT update features here (since configuration failed)
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    # ✅ Only update features AFTER successful execution
    if device.features is None:
        device.features = {}

    device.features["syslogs"] = "configured"
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

    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=trapsXEPlaybook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": "admin",
            "password": "cisco123",
            "snmp_trap_host": "192.168.1.191",
            "snmp_trap_port": 1161,
            "snmp_user": "SNMPv3",
            "snmp_auth_pass": "AuTH_P@55w0rd123!",
            "snmp_priv_pass": "PrIV@TE_P@55w0rd456!",
            "snmp_engine_id": "800000090300500000030000"
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

    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=netflowXEPlaybook,
        extra_vars={
            "router_ip": device.ip_address,
            "username": "admin",
            "password": "cisco123",
            "netflow_interfaces": config.interfaces
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