from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.devices import models, schemas

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
    """
    Create a new device.
    """
    db_device = await db.execute(
        select(models.Device).where(models.Device.hostname == device_in.hostname)
    )
    if db_device.scalars().first():
        raise HTTPException(status_code=400, detail="Device with this hostname already exists")
    db_device = models.Device(**device_in.model_dump())
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