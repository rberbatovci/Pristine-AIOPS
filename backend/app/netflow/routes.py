# routes.py

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List, Optional
from ..db.session import get_db, opensearch_client
from .models import IPFIXHeader as IPFIXHeaderModel, FlowRecord as FlowRecordModel
from .schemas import NetFlowPacket, IPFIXHeader as IPFIXHeaderSchema, FlowRecord as FlowRecordSchema
from opensearchpy import OpenSearch
from collections import defaultdict
from app.auth.keycloak import get_current_user, require_admin 
from datetime import datetime

router = APIRouter(
    prefix="/api/netflow",
    tags=["netflow,events"],
)

def ns_to_datetime(ns_timestamp: int) -> datetime:
    seconds = ns_timestamp / 1_000_000_000
    return datetime.utcfromtimestamp(seconds)

client = OpenSearch([{'host': 'localhost', 'port': 9200}])


# ============================================================
# NETFLOW STATIC FIELDS
# ============================================================

NETFLOW_FIELDS = {
    "device",
    "source_ip",
    "dest_ip",
    "source_port",
    "dest_port",
    "protocol",
    "input_if",
    "output_if",
    "bytes",
    "packets",
    "first_switched",
    "last_switched",
}


# Fields mapped as `text` with a `.keyword` sub-field
NETFLOW_KEYWORD_FIELDS = {
    "device",
    "source_ip",
    "dest_ip",
}


@router.get("/")
async def get_netflow(
    request: Request,
    page: int = Query(
        1,
        ge=1,
        description="Page number"
    ),
    page_size: int = Query(
        10,
        ge=1,
        le=100,
        description="Number of items per page"
    ),
    start_time: Optional[datetime] = Query(
        None,
        description="Filter start timestamp"
    ),
    end_time: Optional[datetime] = Query(
        None,
        description="Filter end timestamp"
    ),
    user: dict = Depends(get_current_user)
):
    start = (page - 1) * page_size

    filter_clauses = []

    # ---------------------------------------------------------
    # TIME RANGE
    # ---------------------------------------------------------

    if start_time or end_time:

        time_range = {}

        if start_time:
            time_range["gte"] = start_time.isoformat()

        if end_time:
            time_range["lte"] = end_time.isoformat()

        filter_clauses.append({
            "range": {
                "@timestamp": time_range
            }
        })

    # ---------------------------------------------------------
    # DYNAMIC FILTERS
    # ---------------------------------------------------------

    query_params = request.query_params.multi_items()

    fixed_params = {
        "page",
        "page_size",
        "start_time",
        "end_time"
    }

    dynamic_filters = [
        (key, value)
        for key, value in query_params
        if key not in fixed_params
    ]

    filter_dict = defaultdict(list)

    for key, value in dynamic_filters:
        filter_dict[key].append(value)

    # Fields that are text + keyword in OpenSearch
    keyword_fields = {
        "device",
        "source_ip",
        "dest_ip"
    }

    for field, values in filter_dict.items():

        # Use .keyword for exact matching on text fields
        if field in keyword_fields:
            es_field = f"{field}.keyword"
        else:
            es_field = field

        if len(values) == 1:
            filter_clauses.append({
                "term": {
                    es_field: values[0]
                }
            })
        else:
            filter_clauses.append({
                "terms": {
                    es_field: values
                }
            })

    # ---------------------------------------------------------
    # OPENSEARCH QUERY
    # ---------------------------------------------------------

    body = {
        "query": {
            "bool": {
                "filter": filter_clauses
            }
        },

        # MOST RECENT FLOWS FIRST
        "sort": [
            {
                "@timestamp": {
                    "order": "desc"
                }
            }
        ],

        "from": start,
        "size": page_size,

        # Don't calculate relevance scores
        "track_total_hits": True
    }

    response = opensearch_client.search(
        index="netflow",
        body=body
    )

    hits = response["hits"]["hits"]

    total = response["hits"]["total"]["value"]

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/options/{field}")
async def get_netflow_field_options(
    field: str,
    request: Request,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    user: dict = Depends(get_current_user)
):
    """
    Return filter options for a NetFlow field.

    The available fields are defined by NETFLOW_FIELDS.

    Example:

        GET /api/netflow/options/source_ip

    Returns:

        [
            {
                "value": "192.168.1.10",
                "label": "192.168.1.10"
            },
            ...
        ]
    """

    # --------------------------------------------------------
    # Validate field
    # --------------------------------------------------------

    if field not in NETFLOW_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid NetFlow field: {field}"
        )

    # --------------------------------------------------------
    # Determine OpenSearch field
    # --------------------------------------------------------

    if field in NETFLOW_KEYWORD_FIELDS:
        es_field = f"{field}.keyword"
    else:
        es_field = field

    # --------------------------------------------------------
    # Build filters
    #
    # We intentionally exclude the current field so that
    # requesting options for e.g. source_ip does not filter
    # source_ip itself.
    # --------------------------------------------------------

    filter_clauses = []

    # --------------------------------------------------------
    # Time filter
    # --------------------------------------------------------

    if start_time or end_time:

        time_range = {}

        if start_time:
            time_range["gte"] = start_time.isoformat()

        if end_time:
            time_range["lte"] = end_time.isoformat()

        filter_clauses.append({
            "range": {
                "@timestamp": time_range
            }
        })

    # --------------------------------------------------------
    # Dynamic filters
    # --------------------------------------------------------

    query_params = request.query_params.multi_items()

    fixed_params = {
        "start_time",
        "end_time",
        "page",
        "page_size",
    }

    dynamic_filters = [
        (key, value)
        for key, value in query_params
        if key not in fixed_params
        and key != field
    ]

    filter_dict = defaultdict(list)

    for key, value in dynamic_filters:
        filter_dict[key].append(value)

    # --------------------------------------------------------
    # Apply existing filters
    # --------------------------------------------------------

    for filter_field, values in filter_dict.items():

        # Ignore unknown fields
        if filter_field not in NETFLOW_FIELDS:
            continue

        if filter_field in NETFLOW_KEYWORD_FIELDS:
            filter_es_field = f"{filter_field}.keyword"
        else:
            filter_es_field = filter_field

        if len(values) == 1:
            filter_clauses.append({
                "term": {
                    filter_es_field: values[0]
                }
            })
        else:
            filter_clauses.append({
                "terms": {
                    filter_es_field: values
                }
            })

    # --------------------------------------------------------
    # Aggregation query
    # --------------------------------------------------------

    body = {
        "size": 0,

        "query": {
            "bool": {
                "filter": filter_clauses
            }
        },

        "aggs": {
            "options": {
                "terms": {
                    "field": es_field,
                    "size": 100
                }
            }
        }
    }

    # --------------------------------------------------------
    # OpenSearch
    # --------------------------------------------------------

    response = opensearch_client.search(
        index="netflow",
        body=body
    )

    # --------------------------------------------------------
    # Convert aggregation buckets into React Select options
    # --------------------------------------------------------

    buckets = response["aggregations"]["options"]["buckets"]

    return [
        {
            "value": bucket["key"],
            "label": str(bucket["key"])
        }
        for bucket in buckets
    ]