from fastapi import APIRouter, HTTPException, Depends
from ncclient import manager
from ncclient.xml_ import to_ele
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.devices.models import Device
import xmltodict
import os

router = APIRouter()

# Cisco IOS-XR filters
XR_FILTERS = {
    "cpu": """
    <filter>
      <cpu-utilization xmlns="http://cisco.com/ns/yang/Cisco-IOS-XR-wdsysmon-fd-oper"/>
    </filter>
    """,
    "memory": """
    <filter>
      <memory-summary xmlns="http://cisco.com/ns/yang/Cisco-IOS-XR-nto-misc-oper">
        <nodes>
          <node>
            <summary/>
          </node>
        </nodes>
      </memory-summary>
    </filter>
    """,
}

# Cisco IOS-XE filters
XE_FILTERS = {
    "cpu": """
    <filter>
      <cpu-usage-information xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-process-cpu-oper"/>
    </filter>
    """,
    "memory": """
    <filter>
      <process-memory-information xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-process-memory-oper"/>
    </filter>
    """
}

# Helper to get device by hostname
async def get_device_by_hostname(hostname: str, db: AsyncSession):
    result = await db.execute(select(Device).where(Device.hostname == hostname))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{hostname}' not found")
    return device

async def get_filter(device_type: str | None, resource: str):
    if not device_type:
        raise HTTPException(status_code=400, detail="Device type is not set")
    
    device_type = device_type.lower()
    
    if device_type == "ios-xr":
        filter_dict = XR_FILTERS
    elif device_type == "ios-xe":
        filter_dict = XE_FILTERS
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported device type '{device_type}'")
    
    if resource not in filter_dict:
        raise HTTPException(status_code=400, detail=f"No filter defined for '{resource}' on type '{device_type}'")
    
    return filter_dict[resource]

# CPU endpoint
@router.get("/devices/{hostname}/status/cpu/")
async def get_cpu(hostname: str, db: AsyncSession = Depends(get_db)):
    device = await get_device_by_hostname(hostname, db)
    cpu_filter_str = await get_filter(device.version, "cpu")
    
    ssh_username = os.getenv("SSH_USERNAME")
    ssh_password = os.getenv("SSH_PASSWORD")

    DEVICE = {
        "host": device.ip_address,
        "port": 830,
        "username": ssh_username,
        "password": ssh_password,
        "hostkey_verify": False
    }

    try:
        with manager.connect(**DEVICE) as m:
            reply = m.get(to_ele(cpu_filter_str))
            return {"cpu": xmltodict.parse(reply.xml)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Memory endpoint
@router.get("/devices/{hostname}/status/memory/")
async def get_memory(hostname: str, db: AsyncSession = Depends(get_db)):
    device = await get_device_by_hostname(hostname, db)
    memory_filter_str = await get_filter(device.version, "memory")
    
    ssh_username = os.getenv("SSH_USERNAME")
    ssh_password = os.getenv("SSH_PASSWORD")

    DEVICE = {
        "host": device.ip_address,
        "port": 830,
        "username": ssh_username,
        "password": ssh_password,
        "hostkey_verify": False
    }

    try:
        with manager.connect(**DEVICE) as m:
            reply = m.get(to_ele(memory_filter_str))
            return {"memory": xmltodict.parse(reply.xml)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
