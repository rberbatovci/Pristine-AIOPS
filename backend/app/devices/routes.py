from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.devices import models, schemas
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/devices",
    tags=["devices"],
)

# Default feature set
default_features = {
    "syslogs": False,
    "snmp_traps": False,
    "netflow": False, 
    "telemetry": {
        "enabled": False,
        "features": {
            "system_util": False,
            "interface_stats": False,
            "bgp_connections": False,
            "isis_stats": False,
            "rib_table": False,
            "fib_entry": False,
            "ospf_stats": False,
            "lldp_stats": False
        },
    },
    "topology": False,
    "authentication": False
}


# ✅ GET all devices (AUTH REQUIRED)
@router.get("/", response_model=List[dict])
async def get_device_ids_names(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Retrieve a list of devices.
    Requires valid Keycloak JWT.
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
            "features": features,
        }
        for id, hostname, ip_address, vendor, version, features in devices
    ]


# ✅ POST a new device (ADMIN ONLY)
@router.post("/", response_model=schemas.DeviceResponse, status_code=201)
async def create_device(
    device_in: schemas.DeviceCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    roles = user.get("realm_access", {}).get("roles", [])

    require_admin(user)

    existing = await db.execute(
        select(models.Device).where(models.Device.hostname == device_in.hostname)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Device with this hostname already exists")

    device_data = device_in.model_dump()

    db_device = models.Device(
        ip_address=device_data.get("ip_address"),
        hostname=device_data.get("hostname"),
        features=default_features,
    )

    db.add(db_device)
    await db.commit()
    await db.refresh(db_device)

    return db_device


# ✅ GET device by hostname (AUTH REQUIRED)
@router.get("/{hostname}", response_model=schemas.DeviceResponse)
async def get_device_by_hostname(
    hostname: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Device).where(models.Device.hostname == hostname)
    )

    db_device = result.scalars().first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")

    return db_device


# ✅ DELETE device by hostname (ADMIN ONLY)
@router.delete("/{hostname}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    hostname: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    roles = user.get("realm_access", {}).get("roles", [])

    require_admin(user)

    result = await db.execute(
        select(models.Device).where(models.Device.hostname == hostname)
    )

    db_device = result.scalars().first()
    if not db_device:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.delete(db_device)
    await db.commit()
