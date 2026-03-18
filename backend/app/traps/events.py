from datetime import datetime
from typing import Optional, Dict, List
from collections import defaultdict
from fastapi import APIRouter, Query, Request, Body, Depends
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.db.session import Base, get_db, opensearch_client
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/traps",
    tags=["traps,events"],
)

TOP_LEVEL_FIELDS = ["device", "snmpTrapOid", "sysUpTime"]

# ======================
# SQLAlchemy Model
# ======================
class Trap(Base):
    __tablename__ = "traps"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())
    content = Column(JSON, nullable=False, default=dict)
    signal = Column(JSON, nullable=True, default=dict)
    tags = Column(JSON, nullable=True, default=dict)
    device = Column(String(255), nullable=False)
    trapOid = Column(String(255), nullable=True)

# ======================
# API Routes
# ======================
@router.get("/")
async def get_traps(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    user: dict = Depends(get_current_user)
):
    start = (page - 1) * page_size
    must_clauses = []

    if start_time and end_time:
        must_clauses.append({
            "range": {
                "timestamp": {
                    "gte": start_time.isoformat(),
                    "lte": end_time.isoformat()
                }
            }
        })

    query_params = request.query_params.multi_items()
    fixed_params = {"page", "page_size", "start_time", "end_time"}

    dynamic_filters = [(k, v) for k, v in query_params if k not in fixed_params]
    filter_dict = defaultdict(list)
    for k, v in dynamic_filters:
        filter_dict[k].append(v)

    for field, values in filter_dict.items():
        if field in TOP_LEVEL_FIELDS:
            es_field = field
        else:
            es_field = f"content.{field}"

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

    response = opensearch_client.search(index='traps', body=body)
    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.post("/bulk")
async def get_multiple_traps(trap_ids: list[str] = Body(..., embed=True), user: dict = Depends(get_current_user)):
    query = {
        "query": {
            "terms": {
                "trap_id.keyword": trap_ids
            }
        },
        "size": len(trap_ids)  # adjust if expecting many results
    }

    response = opensearch_client.search(index="traps", body=query)
    results = [hit["_source"] for hit in response["hits"]["hits"]]

    return {
        "results": results,
        "requested_ids": trap_ids,
        "found_count": len(results),
        "not_found_ids": list(set(trap_ids) - {doc["trap_id"] for doc in results})
    }

