from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from app.signals.models import SyslogSignalSeverity
from app.signals.schemas import SyslogSignalSeverityBase
from app.syslogs.mnemonics import Mnemonic
from app.db.session import get_db, opensearch_client, redis_client
from .services import save_syslog_severity_to_redis, updateMnemonicSettings
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import json

router = APIRouter()

@router.get("/syslogsignals/syslogsignalseverity", response_model=SyslogSignalSeverityBase)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/syslogsignals/syslogsignalseverity", response_model=SyslogSignalSeverityBase)
async def update_syslog_severity(
    updated_settings: SyslogSignalSeverityBase,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()

    if settings:
        settings.number = updated_settings.number
        settings.severity = updated_settings.severity
        settings.description = updated_settings.description
    else:
        settings = SyslogSignalSeverity(
            id=1,
            number=updated_settings.number,
            severity=updated_settings.severity,
            description=updated_settings.description
        )
        db.add(settings)

    await db.commit()
    await db.refresh(settings)

    # Update Redis
    save_syslog_severity_to_redis(
        number=settings.number,
        severity=settings.severity,
        description=settings.description
    )

    return settings