from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.devices.models import Device
import os
import urllib3
import requests
from requests.auth import HTTPBasicAuth

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

router = APIRouter()

HEADERS = {
    "Accept": "application/yang-data+json",
    "Content-Type": "application/yang-data+json"
}

# Helper to get device by hostname
async def get_device_by_hostname(hostname: str, db: AsyncSession):
    result = await db.execute(select(Device).where(Device.hostname == hostname))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{hostname}' not found")
    return device

# Helper to select RESTCONF path based on version and type
def get_restconf_path(device_version: str, metric: str) -> str:
    if "ios-xr" in device_version:
        if metric == "cpu":
            return "Cisco-IOS-XR-wdsysmon-fd-oper:system-monitoring/cpu-utilization"
        elif metric == "memory":
            return "Cisco-IOS-XR-nto-misc-oper:memory-summary/nodes/node/summary"
        elif metric == "interfaces":
            return "Cisco-IOS-XR-infra-statsd-oper:infra-statistics/interfaces/interface/latest/generic-counters"
    else:  # default to IOS-XE
        if metric == "cpu":
            return "Cisco-IOS-XE-process-cpu-oper:cpu-usage/cpu-utilization"
        elif metric == "memory":
            return "Cisco-IOS-XE-memory-oper:memory-statistics/memory-statistic"
        elif metric == "interfaces":
            return "ietf-interfaces:interfaces-state"
    raise ValueError(f"No RESTCONF path for {metric} on version {device_version}")

# CPU endpoint
@router.get("/devices/{hostname}/status/live/cpu/")
async def get_cpu(hostname: str, db: AsyncSession = Depends(get_db)):
    device = await get_device_by_hostname(hostname, db)
    username = os.getenv("SSH_USERNAME")
    password = os.getenv("SSH_PASSWORD")
    path = get_restconf_path(device.version, "cpu")
    url = f"https://{device.ip_address}/restconf/data/{path}"
    print(f"Fetching CPU from {url}")
    try:
        response = requests.get(url, headers=HEADERS, auth=HTTPBasicAuth(username, password), verify=False)
        if response.status_code == 200:
            return {"cpu": response.json()}
        else:
            raise HTTPException(status_code=response.status_code, detail=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Memory endpoint
@router.get("/devices/{hostname}/status/live/memory/")
async def get_memory(hostname: str, db: AsyncSession = Depends(get_db)):
    device = await get_device_by_hostname(hostname, db)
    username = os.getenv("SSH_USERNAME")
    password = os.getenv("SSH_PASSWORD")
    path = get_restconf_path(device.version, "memory")
    url = f"https://{device.ip_address}/restconf/data/{path}"

    try:
        response = requests.get(url, headers=HEADERS, auth=HTTPBasicAuth(username, password), verify=False)
        if response.status_code == 200:
            return {"memory": response.json()}
        else:
            raise HTTPException(status_code=response.status_code, detail=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/devices/{hostname}/status/live/interfaces/")
async def get_interfaces(hostname: str, db: AsyncSession = Depends(get_db)):
    device = await get_device_by_hostname(hostname, db)
    username = os.getenv("SSH_USERNAME")
    password = os.getenv("SSH_PASSWORD")
    path = get_restconf_path(device.version, "interfaces")
    url = f"https://{device.ip_address}/restconf/data/{path}"
    print(f"Fetching CPU from {url}")

    try:
        response = requests.get(url, headers=HEADERS, auth=HTTPBasicAuth(username, password), verify=False)
        if response.status_code == 200:
            return {"interfaces": response.json()}  # <-- return interfaces, not memory
        else:
            raise HTTPException(status_code=response.status_code, detail=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))