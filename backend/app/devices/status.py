from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.devices.models import Device
from app.auth.keycloak import get_current_user

import os
import urllib3
import requests
from requests.auth import HTTPBasicAuth
import redis.asyncio as redis
import json


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


router = APIRouter(
    prefix="/api/devices/status",
    tags=["devices", "status"],
)


# ============================================================
# CONFIGURATION
# ============================================================

HEADERS = {
    "Accept": "application/yang-data+json",
    "Content-Type": "application/yang-data+json",
}


# Async Redis client
r = redis.Redis(
    host="Redis",
    port=6379,
    db=0,
    decode_responses=True,
)


# ============================================================
# REDIS PING - ALL DEVICES
# ============================================================

@router.get("/ping")
async def get_all_device_pings(
    user: dict = Depends(get_current_user),
):
    """
    Return the latest ICMP ping state for all devices.

    Redis structure:

        ping:status

    Redis HASH fields:

        192.168.1.193
        192.168.1.194
        192.168.1.195

    Redis HASH values:

        {
            "hostname": "NX9kv-Switch3",
            "ip": "192.168.1.193",
            "status": "down",
            "rtt_ms": 0,
            "timestamp": "2026-09-17T18:27:40Z"
        }

    The IP address is used as the Redis HASH field because
    ICMP ping is performed against the IP address.
    """

    try:

        # ---------------------------------------------------------
        # Get all current ping states from the Redis HASH
        # ---------------------------------------------------------
        #
        # Redis command:
        #
        #     HGETALL ping:status
        #
        # Result:
        #
        #     {
        #         b"192.168.1.193": b"{...}",
        #         b"192.168.1.194": b"{...}",
        #         b"192.168.1.195": b"{...}"
        #     }
        #
        ping_states = await r.hgetall("ping:status")

        result = []

        # ---------------------------------------------------------
        # Process each device
        # ---------------------------------------------------------

        for ip, value in ping_states.items():

            try:

                # Redis may return bytes depending on the
                # Redis client configuration.
                if isinstance(ip, bytes):
                    ip = ip.decode("utf-8")

                if isinstance(value, bytes):
                    value = value.decode("utf-8")

                # Decode JSON
                ping_data = json.loads(value)

                # -------------------------------------------------
                # Ensure IP exists in the returned object
                # -------------------------------------------------
                #
                # The Redis HASH field is the authoritative IP
                # for this current ping state.
                #
                if not ping_data.get("ip"):
                    ping_data["ip"] = ip

                # -------------------------------------------------
                # Add the result
                # -------------------------------------------------

                result.append(ping_data)

            except json.JSONDecodeError:
                # Ignore invalid JSON entries
                continue

            except Exception:
                # Ignore an individual malformed Redis entry
                continue

        # ---------------------------------------------------------
        # Return current device states
        # ---------------------------------------------------------

        return {
            "count": len(result),
            "devices": result,
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Redis error: {str(e)}",
        )


# ============================================================
# REDIS PING - SINGLE DEVICE
# ============================================================

@router.get("/ping/{hostname}")
async def get_device_ping(
    hostname: str,
    user: dict = Depends(get_current_user),
):
    """
    Return the latest ICMP ping state for one device.
    """

    try:
        data = await r.hget(
            "icmp-ping",
            hostname,
        )

        if data is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No ICMP ping data found for device "
                    f"'{hostname}'"
                ),
            )

        try:
            ping_data = json.loads(data)

        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Invalid ICMP ping JSON stored "
                    f"for '{hostname}'"
                ),
            )

        return {
            "hostname": hostname,
            "ping": ping_data,
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Redis error: {str(e)}",
        )


# ============================================================
# DATABASE HELPER
# ============================================================

async def get_device_by_hostname(
    hostname: str,
    db: AsyncSession,
):
    """
    Get a device from PostgreSQL using hostname.
    """

    result = await db.execute(
        select(Device).where(
            Device.hostname == hostname
        )
    )

    device = result.scalar_one_or_none()

    if not device:
        raise HTTPException(
            status_code=404,
            detail=f"Device '{hostname}' not found",
        )

    return device


# ============================================================
# REDIS TELEMETRY
# ============================================================

async def fetch_last_status(
    hostname: str,
    metric: str,
):
    """
    Fetch the latest telemetry snapshot from Redis.
    """

    # --------------------------------------------------------
    # CPU
    # --------------------------------------------------------

    if metric == "cpu":

        redis_key = (
            f"set:device:{hostname}:cpu"
        )

        value = await r.get(redis_key)

        if value:

            try:
                return json.loads(value)

            except json.JSONDecodeError:
                return {
                    "error": "invalid cpu json"
                }

        return {
            "error": "no cpu data"
        }


    # --------------------------------------------------------
    # MEMORY
    # --------------------------------------------------------

    if metric == "memory":

        pattern = (
            f"set:device:{hostname}:memory:*"
        )

        results = {}

        async for key in r.scan_iter(
            match=pattern
        ):

            value = await r.get(key)

            if not value:
                continue

            memory_name = key.split(
                ":memory:",
                1
            )[1]

            try:
                results[memory_name] = json.loads(
                    value
                )

            except json.JSONDecodeError:
                results[memory_name] = {
                    "error": "invalid memory json"
                }

        if results:
            return results

        return {
            "error": "no memory data found"
        }


    # --------------------------------------------------------
    # INTERFACE STATISTICS
    # --------------------------------------------------------

    if metric == "iface-stats":

        pattern = (
            f"set:device:{hostname}:iface-stats:*"
        )

        results = {}

        async for key in r.scan_iter(
            match=pattern
        ):

            value = await r.get(key)

            if not value:
                continue

            interface = key.split(":")[-1]

            try:
                results[interface] = json.loads(
                    value
                )

            except json.JSONDecodeError:
                results[interface] = value

        if results:
            return results

        return {
            "error": "no interface statistics found"
        }


    # --------------------------------------------------------
    # INTERFACE OPERATIONAL STATUS
    # --------------------------------------------------------

    if metric == "iface-oper":

        pattern = (
            f"set:device:{hostname}:iface-oper:*"
        )

        results = {}

        async for key in r.scan_iter(
            match=pattern
        ):

            value = await r.get(key)

            if not value:
                continue

            interface = key.split(":")[-1]

            try:
                results[interface] = json.loads(
                    value
                )

            except json.JSONDecodeError:
                results[interface] = value

        if results:
            return results

        return {
            "error": (
                "no interface operational "
                "status found"
            )
        }


    # --------------------------------------------------------
    # DEFAULT METRIC
    # --------------------------------------------------------

    redis_key = (
        f"set:device:{hostname}:{metric}"
    )

    value = await r.get(redis_key)

    if value:

        try:
            return json.loads(value)

        except json.JSONDecodeError:
            return {
                "raw": value
            }

    return {
        "error": f"no {metric} data"
    }


# ============================================================
# REDIS "LAST" STATUS ENDPOINT
# ============================================================

@router.get("/{hostname}/{metric}/last")
async def get_last_status(
    hostname: str,
    metric: str,
    user: dict = Depends(get_current_user),
):
    """
    Get the latest telemetry stored in Redis.

    Examples:

        /api/devices/status/CSR1kv-Router5/cpu/last
        /api/devices/status/CSR1kv-Router5/memory/last
        /api/devices/status/CSR1kv-Router5/iface-stats/last
        /api/devices/status/CSR1kv-Router5/iface-oper/last
    """

    return await fetch_last_status(
        hostname,
        metric,
    )


# ============================================================
# RESTCONF PATH
# ============================================================

def get_restconf_path(
    version: str,
    metric: str,
):
    """
    Map telemetry metric to RESTCONF path.

    IMPORTANT:
    Keep/update these paths according to your
    Cisco device/YANG model.
    """

    paths = {

        "cpu":
            "Cisco-IOS-XE-process-cpu-oper:cpu-usage",

        "memory":
            "Cisco-IOS-XE-memory-oper:memory-statistics",

        "iface-stats":
            "openconfig-interfaces:interfaces",

        "iface-oper":
            "openconfig-interfaces:interfaces",
    }

    if metric not in paths:

        raise HTTPException(
            status_code=400,
            detail=f"Unsupported metric '{metric}'",
        )

    return paths[metric]


# ============================================================
# LIVE RESTCONF
# ============================================================

async def fetch_live_status(
    hostname: str,
    metric: str,
    db: AsyncSession,
):
    """
    Fetch live metric from RESTCONF on the device.
    """

    device = await get_device_by_hostname(
        hostname,
        db,
    )

    username = os.getenv(
        "SSH_USERNAME"
    )

    password = os.getenv(
        "SSH_PASSWORD"
    )

    if not username or not password:

        raise HTTPException(
            status_code=500,
            detail=(
                "SSH_USERNAME or SSH_PASSWORD "
                "environment variable is missing"
            ),
        )

    path = get_restconf_path(
        device.version,
        metric,
    )

    url = (
        f"https://{device.ip_address}"
        f"/restconf/data/{path}"
    )

    try:

        response = requests.get(
            url,
            headers=HEADERS,
            auth=HTTPBasicAuth(
                username,
                password,
            ),
            verify=False,
            timeout=10,
        )

        if response.status_code == 200:

            return {
                metric: response.json()
            }

        raise HTTPException(
            status_code=response.status_code,
            detail=response.text,
        )

    except HTTPException:
        raise

    except requests.RequestException as e:

        raise HTTPException(
            status_code=502,
            detail=(
                f"RESTCONF connection failed: {str(e)}"
            ),
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# LIVE RESTCONF ENDPOINT
# ============================================================

@router.get("/{hostname}/{metric}/live")
async def get_live_status(
    hostname: str,
    metric: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Fetch live metric directly from RESTCONF.

    Examples:

        /api/devices/status/CSR1kv-Router5/cpu/live
        /api/devices/status/CSR1kv-Router5/memory/live
        /api/devices/status/CSR1kv-Router5/iface-stats/live
    """

    return await fetch_live_status(
        hostname,
        metric,
        db,
    )

# Latest Redis data
@router.get("/{hostname}/{metric}/")
async def get_last_status(
    hostname: str,
    metric: str,
    user: dict = Depends(get_current_user),
):
    return await fetch_last_status(
        hostname,
        metric,
    )


# Live RESTCONF data
@router.get("/{hostname}/{metric}/live")
async def get_live_status(
    hostname: str,
    metric: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    return await fetch_live_status(
        hostname,
        metric,
        db,
    )