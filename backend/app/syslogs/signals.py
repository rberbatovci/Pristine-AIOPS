from fastapi import APIRouter, HTTPException
from sqlalchemy import Column, String, Integer, ForeignKey, JSON 
from app.db.session import Base, get_db, opensearch_client
from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.syslogs.services import syslog_signal_events

router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class SyslogSignal(Base):
    __tablename__ = "syslog_signal"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(10), nullable=False)
    startTime = Column(DateTime, nullable=False)
    endTime = Column(DateTime, nullable=True)
    hostname = Column(String, ForeignKey("device.hostname"), nullable=False)
    source = Column(String(15), nullable=True)
    affectedEntity = Column(JSON, nullable=True)
    description = Column(Text, default='')
    rule_name = Column(String(255), ForeignKey("stateful_syslog_rules.name"), nullable=False)
    mnemonics_name = Column(String(255), ForeignKey("mnemonics.name"), nullable=False)
    events = relationship("Syslog", secondary="syslog_signal_events", back_populates="signals")

# ======================
# Pydantic Schemas
# ======================
class SyslogSignalSeverityBase(BaseModel):
    number: int
    severity: str
    description: str

    class Config:
        from_attributes = True 


class SyslogSignalBase(BaseModel):
    state: str
    startTime: datetime
    endTime: Optional[datetime] = None
    source: Optional[str] = None
    rule_id: Optional[int] = None
    device_id: Optional[int] = None
    affectedEntity: Optional[dict] = None
    description: Optional[str] = ''


class SyslogSignalCreate(SyslogSignalBase):
    pass


class SyslogSignalRead(SyslogSignalBase):
    id: int

    class Config:
        from_attributes = True

# ======================
# API Routes
# ======================
@router.get("/signals/syslogsignals/")
async def get_all_syslog_signals():
    body = {
        "query": {"match_all": {}},
        "size": 10000
    }
    response = opensearch_client.search(
        index='syslog-signals',
        body=body
    )

    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total
    }

@router.get("/signals/syslogsignals/{signal_id}")
def get_signal(signal_id: int):
    key = f"sig:sys:{signal_id}"
    val = redis_client.get(key)
    if val is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    # val is a JSON string, decode to dict before returning
    signal = json.loads(val)
    return signal

@router.get("/signals/syslogs/devices/options")
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
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["devices"]["buckets"]]

@router.get("/signals/syslogs/rules/options")
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
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["rules"]["buckets"]]

@router.get("/signals/syslogs/mnemonics/options")
def get_mnemonics():
    query = {
        "size": 0,
        "aggs": {
            "mnemonics": {
                "terms": {
                    "field": "mnemonics",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["mnemonics"]["buckets"]]

@router.get("/signals/syslogs/affected-entities/options/{entity_key}")
def get_affected_entity_values(entity_key: str):
    index_name = "syslog-signals"
    
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