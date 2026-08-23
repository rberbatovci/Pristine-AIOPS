import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from dateutil import parser
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth.keycloak import get_current_user, require_admin
from app.db.session import get_db, opensearch_client

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/telemetry",
    tags=["telemetry"],
)


def safe_parse_datetime(date_input: Optional[Any]) -> Optional[str]:
    """
    Safely parses diverse datetime string formats (ISO, JS Date.toString(), datetime objects)
    and returns a standard ISO-8601 string for OpenSearch queries.
    """
    if not date_input:
        return None
    if isinstance(date_input, datetime):
        return date_input.isoformat()
    try:
        parsed_dt = parser.parse(str(date_input))
        return parsed_dt.isoformat()
    except Exception as err:
        logger.warning(f"Could not parse date parameter '{date_input}': {err}")
        return None


def build_opensearch_query(
    filters: Dict[str, Any],
    start_time: Optional[Any] = None,
    end_time: Optional[Any] = None,
    limit: int = 100,
) -> Dict[str, Any]:
    """Helper function to construct OpenSearch term + range query structures."""
    filter_clauses = []

    # Exact term filters
    for field, value in filters.items():
        if value is not None:
            filter_clauses.append({"term": {field: value}})

    # Time range filters
    iso_start = safe_parse_datetime(start_time)
    iso_end = safe_parse_datetime(end_time)

    if iso_start or iso_end:
        range_query = {}
        if iso_start:
            range_query["gte"] = iso_start
        if iso_end:
            range_query["lte"] = iso_end
        filter_clauses.append({"range": {"timestamp": range_query}})

    return {
        "query": {
            "bool": {
                "filter": filter_clauses
            }
        },
        "size": limit,
        "sort": [
            {"timestamp": {"order": "desc"}}
        ]
    }


def execute_opensearch_search(index_name: str, query: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to execute search and catch database exceptions safely."""
    try:
        return opensearch_client.search(index=index_name, body=query)
    except Exception as e:
        logger.error(f"OpenSearch query error on index '{index_name}': {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OpenSearch query failed: {str(e)}"
        )


@router.get("/cpu-utilization/")
def get_cpu_utilization(
    device: Optional[str] = Query(None),
    startTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    endTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    limit: int = Query(100, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    query = build_opensearch_query(
        filters={"device": device},
        start_time=startTime,
        end_time=endTime,
        limit=limit
    )
    response = execute_opensearch_search("cpu-utilization", query)
    hits = response.get("hits", {}).get("hits", [])
    
    return {"results": [hit["_source"] for hit in hits]}


@router.get("/memory-statistics/")
def get_memory_statistics(
    device: Optional[str] = Query(None),
    memory: Optional[str] = Query(None),
    startTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    endTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    limit: int = Query(100, ge=1, le=1000),
    user: dict = Depends(get_current_user),
):
    query = build_opensearch_query(
        filters={"device": device, "memory": memory},
        start_time=startTime,
        end_time=endTime,
        limit=limit
    )
    response = execute_opensearch_search("memory-statistics", query)
    hits = response.get("hits", {}).get("hits", [])

    results = [
        {
            "device": doc["_source"].get("device"),
            "memory": doc["_source"].get("memory"),
            "stats": doc["_source"].get("stats"),
            "timestamp": doc["_source"].get("timestamp"),
            "ingested_at": doc["_source"].get("ingested_at"),
        }
        for doc in hits
    ]
    return {"results": results}


@router.get("/interface-statistics/interfaces/")
def get_interface_statistics_interfaces(
    device: Optional[str] = Query(None),
    startTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    endTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    user: dict = Depends(get_current_user)
):
    query = build_opensearch_query(
        filters={"device": device},
        start_time=startTime,
        end_time=endTime,
        limit=0
    )
    # Add terms aggregation for unique interface list
    query["aggs"] = {
        "unique_interfaces": {
            "terms": {
                "field": "interface",
                "size": 1000
            }
        }
    }
    # Remove standard sort since size is 0 for aggregations
    query.pop("sort", None)

    response = execute_opensearch_search("interface-statistics", query)
    buckets = (
        response
        .get("aggregations", {})
        .get("unique_interfaces", {})
        .get("buckets", [])
    )

    return {"interfaces": [bucket["key"] for bucket in buckets]}


@router.get("/interface-statistics/")
def get_interface_statistics(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    startTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    endTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    limit: int = Query(100, ge=1, le=1000),
    user: dict = Depends(get_current_user)
):
    query = build_opensearch_query(
        filters={"device": device, "interface": interface},
        start_time=startTime,
        end_time=endTime,
        limit=limit
    )
    response = execute_opensearch_search("interface-statistics", query)
    hits = response.get("hits", {}).get("hits", [])

    results = [
        {
            "device": doc["_source"].get("device"),
            "interface": doc["_source"].get("interface"),
            "stats": doc["_source"].get("stats"),
            "timestamp": doc["_source"].get("timestamp"),
            "ingested_at": doc["_source"].get("ingested_at"),
            "subscription": doc["_source"].get("subscription", {}),
        }
        for doc in hits
    ]
    return {"results": results}


@router.get("/interface-oper-status/")
def get_interface_oper_status(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    startTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    endTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    limit: int = Query(100, ge=1, le=1000),
    user: dict = Depends(get_current_user)
):
    query = build_opensearch_query(
        filters={"device": device, "interface": interface},
        start_time=startTime,
        end_time=endTime,
        limit=limit
    )
    response = execute_opensearch_search("interface-oper-status", query)
    hits = response.get("hits", {}).get("hits", [])

    results = [
        {
            "device": doc["_source"].get("device"),
            "interface": doc["_source"].get("interface"),
            "status": doc["_source"].get("status"),
            "timestamp": doc["_source"].get("timestamp"),
            "ingested_at": doc["_source"].get("ingested_at"),
        }
        for doc in hits
    ]
    return {"results": results}


@router.get("/bgp-statistics/")
def get_bgp_statistics(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    startTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    endTime: Optional[str] = Query(None, description="Accepts ISO strings or raw JS Date strings"),
    limit: int = Query(100, ge=1, le=1000),
    user: dict = Depends(get_current_user)
):
    query = build_opensearch_query(
        filters={"device": device, "neighbor": interface},
        start_time=startTime,
        end_time=endTime,
        limit=limit
    )
    response = execute_opensearch_search("bgp-connections", query)
    hits = response.get("hits", {}).get("hits", [])

    results = [
        {
            "device": doc["_source"].get("device"),
            "neighbor": doc["_source"].get("neighbor"),
            "stats": doc["_source"].get("stats"),
            "timestamp": doc["_source"].get("timestamp"),
            "ingested_at": doc["_source"].get("ingested_at"),
            "subscription": doc["_source"].get("subscription", {}),
        }
        for doc in hits
    ]
    return {"results": results}