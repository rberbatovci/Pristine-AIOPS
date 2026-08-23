from fastapi import APIRouter, Depends, HTTPException, Query, Body 
from typing import List, Optional
from datetime import datetime
from app.db.session import opensearch_client
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/netflow/statistics",
    tags=["netflow", "statistics"],
)

# Map API keys to the correct OpenSearch field names
NETFLOW_STAT_FIELDS = {
    "device": "device.keyword",       # Updated to target .keyword
    "protocol": "protocol",
    "source_ip": "source_ip.keyword", # Updated to target .keyword
    "source_port": "source_port",
    "dest_ip": "dest_ip.keyword",     # Updated to target .keyword
    "dest_port": "dest_port",
    "bytes": "bytes",
    "packets": "packets",
    "input_if": "input_if",
    "output_if": "output_if",
    "first_switched": "first_switched",
    "last_switched": "last_switched",
}


@router.get("/{key}")
def get_field_statistics(
    key: str,
    start_time: Optional[datetime] = Query(None, description="Filter start timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter end timestamp"),
    user: dict = Depends(get_current_user),
):
    """
    Return top value counts for a NetFlow field filtered by an optional time range.

    Example:
        /api/netflow/statistics/dest_ip?start_time=2026-08-14T00:00:00Z&end_time=2026-08-14T23:59:59Z
    """

    if key not in NETFLOW_STAT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported NetFlow field: {key}"
        )

    field = NETFLOW_STAT_FIELDS[key]

    # Build the date range clause dynamically
    range_query = {}
    if start_time:
        range_query["gte"] = start_time.isoformat()
    if end_time:
        range_query["lte"] = end_time.isoformat()

    # Construct the query structure
    filter_clauses = []
    if range_query:
        filter_clauses.append({"range": {"@timestamp": range_query}})

    query = {
        "size": 0,
        "query": {
            "bool": {
                "filter": filter_clauses or [{"match_all": {}}]
            }
        },
        "aggs": {
            "value_counts": {
                "terms": {
                    "field": field,
                    "size": 20,
                    "order": {
                        "_count": "desc"
                    }
                }
            }
        }
    }

    try:
        response = opensearch_client.search(
            index="netflow",
            body=query
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenSearch error: {str(e)}"
        )

    buckets = (
        response
        .get("aggregations", {})
        .get("value_counts", {})
        .get("buckets", [])
    )

    statistics = [
        {
            "value": bucket["key"],
            "count": bucket["doc_count"]
        }
        for bucket in buckets
    ]

    return {
        "key": key,
        "field": field,
        "start_time": start_time,
        "end_time": end_time,
        "statistics": statistics
    }

def get_unique_terms(index: str, field: str, size: int = 1000) -> List[str]:
    try:
        response = opensearch_client.search(
            index=index,
            size=0,
            body={
                "aggs": {
                    "unique_terms": {
                        "terms": {
                            "field": field,
                            "size": size
                        }
                    }
                }
            }
        )
        buckets = response["aggregations"]["unique_terms"]["buckets"]
        return [bucket["key"] for bucket in buckets]
    except Exception as e:
        logger.exception("Error during OpenSearch aggregation")
        raise HTTPException(status_code=500, detail=f"Error getting terms: {str(e)}")

@router.get("/netflow/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate")):
    field_path = field

    try:
        return get_unique_terms(index="netflow", field=field_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))