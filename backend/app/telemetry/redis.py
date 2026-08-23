import json
from fastapi import APIRouter, Query, HTTPException
from fastapi.concurrency import run_in_threadpool
from app.db.session import redis_client

router = APIRouter(
    prefix="/api/telemetry/redis",
    tags=["telemetry", "redis"],
)

def fetch_redis_keys_and_values(pattern: str):
    """
    Synchronous helper function to run in a background threadpool.
    Uses SCAN + MGET for optimal Redis performance.
    """
    keys = []
    cursor = 0

    # 1. Iterate over matching keys non-blockingly using SCAN
    while True:
        cursor, matched_keys = redis_client.scan(
            cursor=cursor, match=pattern, count=100
        )
        keys.extend(matched_keys)
        if cursor == 0:
            break

    if not keys:
        return []

    # 2. Retrieve all key values in a single network round-trip via MGET
    raw_values = redis_client.mget(keys)

    # 3. Parse stringified JSON into dictionaries
    results = []
    for val in raw_values:
        if val:
            try:
                results.append(json.loads(val))
            except json.JSONDecodeError:
                results.append(val)

    return results


@router.get("/")
async def get_redis_telemetry(
    pattern: str = Query("set:device:*:cpu", description="Redis key pattern to search")
):
    """
    FastAPI route wrapper that runs synchronous Redis calls in a threadpool.
    """
    try:
        # Executes sync Redis scanning without blocking the main event loop
        return await run_in_threadpool(fetch_redis_keys_and_values, pattern)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query Redis: {str(e)}"
        )
