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

router = APIRouter()

def ns_to_datetime(ns_timestamp: int) -> datetime:
    seconds = ns_timestamp / 1_000_000_000
    return datetime.utcfromtimestamp(seconds)

client = OpenSearch([{'host': 'localhost', 'port': 9200}])

@router.get("/netflow/")
async def get_netflow(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    start_time: Optional[datetime] = Query(None, description="Filter start timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter end timestamp")
):
    start = (page - 1) * page_size
    must_clauses = []

    # Time range filter
    if start_time and end_time:
        must_clauses.append({
            "range": {
                "timestamp": {
                    "gte": start_time.isoformat(),
                    "lte": end_time.isoformat()
                }
            }
        })

    # Collect extra filters from query params
    query_params = request.query_params.multi_items()
    fixed_params = {"page", "page_size", "start_time", "end_time"}

    dynamic_filters = [(k, v) for k, v in query_params if k not in fixed_params]
    filter_dict = defaultdict(list)
    for k, v in dynamic_filters:
        filter_dict[k].append(v)

    for field, values in filter_dict.items():
        # Decide whether it's a top-level or nested field
        if field in TOP_LEVEL_FIELDS:   # reuse same constant if applicable
            es_field = field
        else:
            es_field = f"tags.{field}"

        if len(values) == 1:
            must_clauses.append({"term": {es_field: values[0]}})
        else:
            must_clauses.append({"terms": {es_field: values}})

    body = {
        "query": {
            "bool": {
                "must": must_clauses or [{"match_all": {}}]
            }
        },
        "from": start,
        "size": page_size
    }

    response = opensearch_client.search(index='netflow', body=body)
    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }