from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import Column, String, Integer, ForeignKey, JSON 
from app.db.session import Base, get_db, opensearch_client
from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from pydantic import BaseModel
from typing import Optional 
from app.auth.keycloak import get_current_user, require_admin
from opensearchpy.exceptions import NotFoundError, TransportError

router = APIRouter(
    prefix="/api/telemetry/signals",
    tags=["telemetry,signals"],
)

# ======================
# SQLAlchemy Model
# ======================
class TelemetrySignal(Base):
    __tablename__ = "telemetry_signal"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(10), nullable=False)
    startTime = Column(DateTime, nullable=False)
    endTime = Column(DateTime, nullable=True)
    hostname = Column(String(15), nullable=True)
    source = Column(String(15), nullable=True)
    affectedEntity = Column(JSON, nullable=True)
    description = Column(Text, default='')  

# ======================
# Pydantic Schemas
# ======================  

class TelemetrySignalBase(BaseModel):
    state: str
    startTime: datetime
    endTime: Optional[datetime] = None
    source: Optional[str] = None
    rule_id: Optional[int] = None
    device_id: Optional[int] = None
    affectedEntity: Optional[dict] = None
    description: Optional[str] = ''


class TelemetrySignalCreate(TelemetrySignalBase):
    pass


class TelemetrySignalRead(TelemetrySignalBase):
    id: int

    class Config:
        from_attributes = True

# ======================
# API Routes
# ======================
@router.get("/")
async def get_all_telemetry_signals(user: dict = Depends(get_current_user)):
    index_name = "telemetry-signals"

    try:
        response = opensearch_client.search(
            index=index_name,
            body={
                "query": {"match_all": {}},
                "size": 10000
            }
        )

        return {
            "results": response['hits']['hits'],
            "total": response['hits']['total']['value']
        }

    except (NotFoundError, TransportError) as e:
        # ✅ Handle missing index specifically
        if hasattr(e, "status_code") and e.status_code == 404:
            return {
                "results": [],
                "total": 0,
                "message": f"Index '{index_name}' does not exist"
            }

        # ❗ re-raise if it's something else
        raise

@router.get("/{signal_id}")
def get_signal(signal_id: int, user: dict = Depends(get_current_user)):
    key = f"sig:telemetry:{signal_id}"
    val = redis_client.get(key)
    if val is None:
        raise HTTPException(status_code=404, detail="Signal not found")
    
    # val is a JSON string, decode to dict before returning
    signal = json.loads(val)
    return signal

@router.get("/devices/options")
def get_devices(user: dict = Depends(get_current_user)):
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
    response = opensearch_client.search(index="telemetry-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["devices"]["buckets"]]

@router.get("/rules/options")
def get_rules(user: dict = Depends(get_current_user)):
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
    response = opensearch_client.search(index="telemetry-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["rules"]["buckets"]]
 

@router.get("/affected-entities/options/{entity_key}")
def get_affected_entity_values(entity_key: str, user: dict = Depends(get_current_user)):
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