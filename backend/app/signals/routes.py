from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from app.signals.models import SyslogSignalSeverity
from app.signals.schemas import SyslogSignalSeverityBase
from app.syslogs.models import Mnemonic
from app.db.session import get_db, opensearch_client
from app.syslogs.services import update_mnemonics_list_in_json
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

router = APIRouter()

@router.get("/signals/syslogsignals/")
async def get_syslogSignals(page: int = Query(1, ge=1, description="Page number"),
                      page_size: int = Query(10, ge=1, le=100, description="Number of items per page")):
    start = (page - 1) * page_size
    body = {
        "query": {"match_all": {}},
        "from": start,
        "size": page_size
    }
    response = opensearch_client.search(
        index='syslog-signals',
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

@router.get("/signals/trapsignals/")
async def get_trapSignals(page: int = Query(1, ge=1, description="Page number"),
                      page_size: int = Query(10, ge=1, le=100, description="Number of items per page")):
    start = (page - 1) * page_size
    body = {
        "query": {"match_all": {}},
        "from": start,
        "size": page_size
    }
    response = opensearch_client.search(
        index='trap-signals',
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

@router.get("/signals/stats/devices/")
async def get_device_statistics():
    body = {
        "size": 0,
        "aggs": {
            "devices": {
                "terms": {
                    "field": "device.keyword",  # Use .keyword for exact match on strings
                    "size": 1000  # Adjust as needed
                }
            }
        }
    }

    response = opensearch_client.search(index="syslog-signals", body=body)

    buckets = response["aggregations"]["devices"]["buckets"]
    stats = [{"device": b["key"], "count": b["doc_count"]} for b in buckets]

    return stats

@router.get("/signals/stats/mnemonics/")
async def get_device_statistics():
    body = {
        "size": 0,
        "aggs": {
            "mnemonics": {
                "terms": {
                    "field": "mnemonics.keyword",  # Use .keyword for exact match on strings
                    "size": 1000  # Adjust as needed
                }
            }
        }
    }

    response = opensearch_client.search(index="syslog-signals", body=body)

    buckets = response["aggregations"]["mnemonics"]["buckets"]
    stats = [{"mnemonic": b["key"], "count": b["doc_count"]} for b in buckets]

    return stats

@router.get("/syslogsignals/syslogsignalseverity", response_model=SyslogSignalSeverityBase)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/syslogsignals/syslogsignalseverity", response_model=SyslogSignalSeverityBase)
async def update_settings(updated_settings: SyslogSignalSeverityBase, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()

    if settings:
        # Update existing settings
        settings.number = updated_settings.number
        settings.severity = updated_settings.severity
        settings.description = updated_settings.description
    else:
        # Create new settings with id=1
        settings = SyslogSignalSeverity(
            id=1,
            number=updated_settings.number,
            severity=updated_settings.severity,
            description=updated_settings.description
        )
        db.add(settings)

    await db.commit()
    await db.refresh(settings)

    # Save to file after updating/creating severity
    await update_mnemonics_list_in_json(db)

    return settings