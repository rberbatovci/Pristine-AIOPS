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
from app.auth.keycloak import get_current_user, require_admin

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

router = APIRouter(
    prefix="/api/devices/status",
    tags=["devices,status"],
)


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
    
    if metric == "memory-stats":
        redis_key = f"telemetry:{hostname}:memory-state"
        memory_data = r.hgetall(redis_key)
        if memory_data:
            return {k.decode("utf-8") if isinstance(k, bytes) else k: int(v) for k, v in memory_data.items()}
        return {"error": "no memory-stats data"}

    if metric == "interfaces":
        # Fetch all interface keys
        pattern = f"telemetry:{hostname}:interface:*"
        keys = r.keys(pattern)
        if not keys:
            return {"error": "no interfaces data"}

        interfaces_data = {}
        for key in keys:
            iface_name = key.decode("utf-8").split(":")[-1] if isinstance(key, bytes) else key.split(":")[-1]
            
            # Determine type: hash or string
            if r.type(key) == b"hash" or r.type(key) == "hash":
                data = r.hgetall(key)
                # decode and parse numeric values where possible
                parsed = {}
                for k, v in data.items():
                    k_str = k.decode("utf-8") if isinstance(k, bytes) else k
                    try:
                        v_num = int(v) if isinstance(v, (int, bytes, str)) and str(v).isdigit() else v
                    except:
                        v_num = v
                    parsed[k_str] = v_num
                interfaces_data[iface_name] = parsed
            else:
                # GET string/JSON
                raw = r.get(key)
                try:
                    parsed = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    parsed = {"raw": raw}
                interfaces_data[iface_name] = parsed

        return interfaces_data

    # For other metrics, use GET as before
    redis_key = f"telemetry:{hostname}:{metric}"
    value = r.get(redis_key)
    if value:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {"raw": value}

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
@router.get("/{hostname}/{metric}/")
def get_last_status(hostname: str, metric: str, user: dict = Depends(get_current_user)):
    return fetch_last_status(hostname, metric)

# ---------- Live RESTCONF endpoints ----------
@router.get("/{hostname}/{metric}/")
async def get_live_status(hostname: str, metric: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    return await fetch_live_status(hostname, metric, db)