from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime

from app.db.session import opensearch_client
from app.auth.keycloak import get_current_user


router = APIRouter(
    prefix="/api/traffic/statistics",
    tags=["traffic", "statistics"],
)


NETFLOW_STAT_FIELDS = {
    "device": "device.keyword",
    "protocol": "protocol",
    "source_ip": "source_ip.keyword",
    "source_port": "source_port",
    "dest_ip": "dest_ip.keyword",
    "dest_port": "dest_port",
    "input_if": "input_if",
    "output_if": "output_if",
    "first_switched": "first_switched",
    "last_switched": "last_switched",
}


def get_date_filter(
    start_time: Optional[datetime],
    end_time: Optional[datetime],
):
    range_query = {}

    if start_time:
        range_query["gte"] = start_time.isoformat()

    if end_time:
        range_query["lte"] = end_time.isoformat()

    if not range_query:
        return []

    return [
        {
            "range": {
                "@timestamp": range_query
            }
        }
    ]


@router.get("/{metric}/{key}")
def get_traffic_statistics(
    metric: str,
    key: str,
    start_time: Optional[datetime] = Query(
        None,
        description="Filter start timestamp"
    ),
    end_time: Optional[datetime] = Query(
        None,
        description="Filter end timestamp"
    ),
    user: dict = Depends(get_current_user),
):
    # -----------------------------------------
    # Validate metric
    # -----------------------------------------

    if metric not in ("bytes", "packets"):
        raise HTTPException(
            status_code=400,
            detail="Metric must be either 'bytes' or 'packets'"
        )

    # -----------------------------------------
    # Validate grouping field
    # -----------------------------------------

    if key not in NETFLOW_STAT_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported NetFlow field: {key}"
        )

    group_field = NETFLOW_STAT_FIELDS[key]

    # -----------------------------------------
    # Select metric field
    # -----------------------------------------

    metric_field = metric

    # -----------------------------------------
    # Build filters
    # -----------------------------------------

    filter_clauses = get_date_filter(
        start_time,
        end_time
    )

    # -----------------------------------------
    # OpenSearch query
    # -----------------------------------------

    query = {
        "size": 0,

        "query": {
            "bool": {
                "filter": filter_clauses or [
                    {
                        "match_all": {}
                    }
                ]
            }
        },

        "aggs": {
            "statistics": {

                "terms": {
                    "field": group_field,
                    "size": 20,
                    "order": {
                        "metric_sum": "desc"
                    }
                },

                "aggs": {
                    "metric_sum": {
                        "sum": {
                            "field": metric_field
                        }
                    }
                }
            }
        }
    }

    # -----------------------------------------
    # Execute OpenSearch query
    # -----------------------------------------

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

    # -----------------------------------------
    # Extract buckets
    # -----------------------------------------

    buckets = (
        response
        .get("aggregations", {})
        .get("statistics", {})
        .get("buckets", [])
    )

    # -----------------------------------------
    # Build response
    # -----------------------------------------

    statistics = [
        {
            "value": bucket["key"],
            "count": bucket["doc_count"],
            "value_sum": bucket["metric_sum"]["value"]
        }
        for bucket in buckets
    ]

    return {
        "metric": metric,
        "key": key,
        "field": group_field,
        "start_time": start_time,
        "end_time": end_time,
        "statistics": statistics
    }