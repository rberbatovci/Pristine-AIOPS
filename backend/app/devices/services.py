from sqlalchemy.ext.asyncio import AsyncSession
from .models import Device
from .schemas import DeviceCreate, DeviceUpdate, DeviceCreateMinimal, DeviceUpdatePartial
from sqlalchemy import select

async def create_device_minimal(db: AsyncSession, device: DeviceCreateMinimal) -> Device:
    db_device = Device(**device.dict())
    db.add(db_device)
    await db.commit()
    await db.refresh(db_device)
    return db_device

async def get_devices(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[Device]:
    devices = await db.execute(select(Device).offset(skip).limit(limit))
    return devices.scalars().all()

async def get_device(db: AsyncSession, device_id: int) -> Device | None:
    return await db.get(Device, device_id)

async def get_device_by_hostname(db: AsyncSession, hostname: str) -> Device | None:
    return await db.get(Device, hostname)

async def delete_device_by_hostname(db: AsyncSession, hostname: str) -> bool:
    device = await db.get(Device, hostname)
    if device:
        await db.delete(device)
        await db.commit()
        return True
    return False

async def update_device_by_hostname(
    db: AsyncSession,
    hostname: str,
    device_update: DeviceUpdatePartial,
) -> Device | None:
    db_device = await db.get(Device, hostname)
    if db_device:
        for key, value in device_update.dict(exclude_unset=True).items():
            setattr(db_device, key, value)
        await db.commit()
        await db.refresh(db_device)
    return db_device

async def delete_device(db: AsyncSession, device_id: int) -> bool:
    device = await db.get(Device, device_id)
    if device:
        await db.delete(device)
        await db.commit()
        return True
    return False
