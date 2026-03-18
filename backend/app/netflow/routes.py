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

router = APIRouter(
    prefix="/api/netflow",
    tags=["netflow,events"],
)

def ns_to_datetime(ns_timestamp: int) -> datetime:
    seconds = ns_timestamp / 1_000_000_000
    return datetime.utcfromtimestamp(seconds)

client = OpenSearch([{'host': 'localhost', 'port': 9200}])

@router.get("/")
async def get_netflow(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Number of items per page"),
    start_time: Optional[datetime] = Query(None, description="Filter start timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter end timestamp"),
    user: dict = Depends(get_current_user)
):
    start = (page - 1) * page_size
    must_clauses = []

    # Time range filter
    if start_time and end_time:
        must_clauses.append({
            "range": {
                "@timestamp": {
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
        es_field = field
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

@router.get("/options")
async def get_netflow_field_values(
    fields: str = Query(..., description="Comma-separated list of fields (e.g. source_ip,dest_ip,protocol)"),
    size: int = Query(100, ge=1, le=10000, description="Number of unique values per field"),
    user: dict = Depends(get_current_user)
):
    """
    Return unique values for given NetFlow fields from OpenSearch.
    """
    field_list = [f.strip() for f in fields.split(",") if f.strip()]
    if not field_list:
        raise HTTPException(status_code=400, detail="No fields provided")

    # Build the aggregations for each field
    aggs = {
        field: {
            "terms": {
                "field": field,
                "size": size
            }
        }
        for field in field_list
    }

    body = {
        "size": 0,  # we only want aggregation results, not documents
        "aggs": aggs
    }

    response = opensearch_client.search(index="netflow", body=body)

    results = {}
    for field in field_list:
        buckets = response["aggregations"][field]["buckets"]
        results[field] = [bucket["key"] for bucket in buckets]

    return results