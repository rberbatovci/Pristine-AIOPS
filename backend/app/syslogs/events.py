from datetime import datetime
from typing import Optional, Dict, Any, List
from collections import defaultdict
from fastapi import APIRouter, Query, Request, Body
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship
from app.db.session import Base, get_db, opensearch_client
from app.syslogs.services import syslog_signal_events

router = APIRouter()

TOP_LEVEL_FIELDS = ["device", "mnemonic", "severity"]

# ======================
# SQLAlchemy Model
# ======================
class Syslog(Base):
    __tablename__ = "syslogs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=True)
    lsn = Column(Integer, nullable=True)
    device = Column(String, ForeignKey("devices.hostname"), nullable=False)
    message = Column(String, nullable=False)
    received_at = Column(DateTime, nullable=False, server_default=func.now())
    tags = Column(JSON, nullable=True, default=dict)
    signal = Column(JSON, nullable=True, default=dict)
    mnemonic = Column(String(50), nullable=True)
    signals = relationship("SyslogSignal", secondary="syslog_signal_events", back_populates="events")

# ======================
# Pydantic Schemas
# ======================
#class SyslogBase(BaseModel):
#    message: str
#    device: str

#class Syslog(SyslogBase):
#    id: int
#    lsn: int
#    tags: Optional[Dict[str, Any]] = None
#    signal: Optional[Dict[str, Any]] = None
#    timestamp: Optional[datetime] = None
#    mnemonic: str

#    class Config:
#        from_attributes = True


# ======================
# API Routes
# ======================
@router.get("/syslogs/")
async def get_syslogs(request: Request, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), start_time: Optional[datetime] = Query(None), end_time: Optional[datetime] = Query(None)):
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

    response = opensearch_client.search(index='syslogs', body=body)
    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.post("/syslogs/bulk")
async def get_multiple_syslogs(syslog_ids: list[str] = Body(..., embed=True)):
    body = {
        "ids": syslog_ids
    }

    response = opensearch_client.mget(index='syslogs', body=body)

    # Extract only found documents
    results = [doc['_source'] for doc in response['docs'] if doc['found']]

    return {
        "results": results,
        "requested_ids": syslog_ids,
        "found_count": len(results),
        "not_found_ids": [doc['_id'] for doc in response['docs'] if not doc['found']]
    }

