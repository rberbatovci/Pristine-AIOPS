# routes.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List
from ..db.session import get_db, opensearch_client
from .models import IPFIXHeader as IPFIXHeaderModel, FlowRecord as FlowRecordModel
from .schemas import NetFlowPacket, IPFIXHeader as IPFIXHeaderSchema, FlowRecord as FlowRecordSchema
from opensearchpy import OpenSearch

router = APIRouter()

def ns_to_datetime(ns_timestamp: int) -> datetime:
    seconds = ns_timestamp / 1_000_000_000
    return datetime.utcfromtimestamp(seconds)

client = OpenSearch([{'host': 'localhost', 'port': 9200}])

@router.get("/netflow/")
async def get_netflow(page: int = Query(1, ge=1, description="Page number"),
                      page_size: int = Query(10, ge=1, le=100, description="Number of items per page")):
    start = (page - 1) * page_size
    body = {
        "query": {"match_all": {}},
        "from": start,
        "size": page_size
    }
    response = opensearch_client.search(
        index='netflow',
        body=body
    )
    
    hits = response['hits']['hits']
    total = response['hits']['total']['value']  # Get total number of matching documents

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

