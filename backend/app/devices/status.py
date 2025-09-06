from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.devices.models import Device
import os
import urllib3
import requests
from requests.auth import HTTPBasicAuth
import redis
import json

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

router = APIRouter()

HEADERS = {
    "Accept": "application/yang-data+json",
    "Content-Type": "application/yang-data+json"
}

r = redis.Redis(host="Redis", port=6379, db=0)

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

# ---------- Redis Fetcher ----------
def fetch_last_status(hostname: str, metric: str):
    """Fetch latest metric from Redis (telemetry)."""
    redis_key = f"telemetry:{hostname}:{metric}"
    value = r.get(redis_key)
    if value:
        return json.loads(value)
    return {"error": f"no {metric} data"}


# ---------- RESTCONF Fetcher ----------
async def fetch_live_status(hostname: str, metric: str, db: AsyncSession):
    """Fetch live metric from RESTCONF on the device."""
    device = await get_device_by_hostname(hostname, db)
    username = os.getenv("SSH_USERNAME")
    password = os.getenv("SSH_PASSWORD")
    path = get_restconf_path(device.version, metric)
    url = f"https://{device.ip_address}/restconf/data/{path}"

    try:
        response = requests.get(url, headers=HEADERS, auth=HTTPBasicAuth(username, password), verify=False)
        if response.status_code == 200:
            return {metric: response.json()}
        raise HTTPException(status_code=response.status_code, detail=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- Redis "last" endpoints ----------
@router.get("/devices/{hostname}/status/last/{metric}/")
def get_last_status(hostname: str, metric: str):
    return fetch_last_status(hostname, metric)


# ---------- Live RESTCONF endpoints ----------
@router.get("/devices/{hostname}/status/live/{metric}/")
async def get_live_status(hostname: str, metric: str, db: AsyncSession = Depends(get_db)):
    return await fetch_live_status(hostname, metric, db)