from fastapi import APIRouter
from typing import Optional
from datetime import datetime
from fastapi import APIRouter
from app.db.session import Base
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from pydantic import BaseModel
from sqlalchemy.orm import relationship

router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class TrapSignal(Base):
    __tablename__ = "trap_signal"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(10), nullable=False)
    startTime = Column(DateTime, nullable=False)
    endTime = Column(DateTime, nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    source = Column(String(15), nullable=True)
    rule_id = Column(Integer, ForeignKey("stateful_trap_rules.id"), nullable=True)
    affectedEntity = Column(JSON, nullable=True)
    description = Column(Text, default='')


# ======================
# Pydantic Schemas
# ======================
class TrapSignalBase(BaseModel):
    state: str
    startTime: datetime
    endTime: Optional[datetime] = None
    source: Optional[str] = None
    rule_id: Optional[int] = None
    device_id: Optional[int] = None
    affectedEntity: Optional[dict] = None
    description: Optional[str] = ''

class TrapSignalCreate(TrapSignalBase):
    pass

class TrapSignalRead(TrapSignalBase):
    id: int

    class Config:
        from_attributes = True


# ======================
# Routes
# ======================
@router.get("/signals/trapsignals/")
async def get_all_trap_signals():
    body = {
        "query": {"match_all": {}},
        "size": 10000
    }
    response = opensearch_client.search(
        index='trap-signals',
        body=body
    )

    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total
    }

@router.get("/signals/traps/devices/options")
def get_devices():
    query = {
        "size": 0,
        "aggs": {
            "devices": {
                "terms": {
                    "field": "device",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["devices"]["buckets"]]

@router.get("/signals/traps/rules/options")
def get_rules():
    query = {
        "size": 0,
        "aggs": {
            "rules": {
                "terms": {
                    "field": "rule",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["rules"]["buckets"]]

@router.get("/signals/traps/snmpTrapOid/options")
def get_mnemonics():
    query = {
        "size": 0,
        "aggs": {
            "snmpTrapOid": {
                "terms": {
                    "field": "snmpTrapOid",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["snmpTrapOid"]["buckets"]]

@router.get("/signals/traps/affected-entities/options/{entity_key}")
def get_affected_entity_values(entity_key: str):
    index_name = "trap-signals"
    
    # Build the aggregation path dynamically
    agg_path = f"affectedEntities.{entity_key}"

    query = {
        "size": 0,
        "aggs": {
            "affected_entity_values": {
                "terms": {
                    "field": agg_path,  # use .keyword to aggregate strings
                    "size": 1000  # adjust as needed
                }
            }
        }
    }

    response = opensearch_client.search(index=index_name, body=query)
    values = [bucket["key"] for bucket in response["aggregations"]["affected_entity_values"]["buckets"]]
    return {"entity": entity_key, "values": values}
