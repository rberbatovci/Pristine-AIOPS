from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.devices import models, schemas
import asyncio
router = APIRouter()
import os

default_features = {
    "syslogs": False,
    "snmp_traps": False,
    "netflow": False,
    "telemetry": {
        "system_util": False,
        "interface_stats": False,
        "bgp_connections": False,
        "isis_stats": False,
        "rib_table": False,
        "fib_entry": False,
    }
}


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