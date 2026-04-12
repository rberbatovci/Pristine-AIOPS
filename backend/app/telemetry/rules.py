from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, JSON, Text, Column, Integer, String, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import relationship, selectinload
from pydantic import BaseModel
from typing import Optional, Any, List
from app.auth.keycloak import get_current_user, require_admin

from app.db.session import Base, get_db 
#from app.syslogs.mnemonics import Mnemonic

router = APIRouter(
    prefix="/api/telemetry/signals/rules",
    tags=["telemetry, signals, rules" ],
) 

# ======================
# SQLAlchemy Model
# ======================
class TelemetrySignalRule(Base):
    __tablename__ = "telemetry_signals_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)

    highthreshold = Column(String(255), nullable=True)
    lowthreshold = Column(String(255), nullable=True)

    openvalue = Column(String(255), nullable=True)
    closevalue = Column(String(255), nullable=True)

    initialseverity = Column(String(255), nullable=False)
    affectedentity = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=False)
    warmup = Column(Integer, nullable=False)
    cooldown = Column(Integer, nullable=False)

# ======================
# Pydantic Schemas
# ======================
class TelemetrySignalRuleBase(BaseModel):
    name: str

    highthreshold: Optional[str] = None
    lowthreshold: Optional[str] = None

    openvalue: Optional[str] = None
    closevalue: Optional[str] = None

    initialseverity: str
    affectedentity: Optional[List[Any]] = None
    description: str
    warmup: int
    cooldown: int


class TelemetrySignalRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class TelemetrySignalRuleRead(TelemetrySignalRuleBase):
    id: int

    class Config:
        orm_mode = True

# ======================
# Rules API Routes
# ======================

@router.get("/", response_model=List[TelemetrySignalRuleBrief])
async def get_telemetry_signal_rules_brief(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(TelemetrySignalRule.id, TelemetrySignalRule.name)
    )
    return [{"id": r[0], "name": r[1]} for r in result.all()]


@router.get("/{rule_name}", response_model=TelemetrySignalRuleRead)
async def get_telemetry_signal_rule(
    rule_name: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    stmt = (
        select(TelemetrySignalRule) 
        .where(TelemetrySignalRule.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return TelemetrySignalRuleRead(
        id=db_rule.id,
        name=db_rule.name,
        highthreshold=db_rule.highthreshold,
        lowthreshold=db_rule.lowthreshold,
        openvalue=db_rule.openvalue,
        closevalue=db_rule.closevalue,
        initialseverity=db_rule.initialseverity,
        affectedentity=db_rule.affectedentity,
        description=db_rule.description,
        warmup=db_rule.warmup,
        cooldown=db_rule.cooldown,
    )

@router.post("/", response_model=TelemetrySignalRuleRead, status_code=201)
async def create_telemetry_signal_rule(
    rule: TelemetrySignalRuleBase,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    from app.syslogs.mnemonics import Mnemonic

    existing_rule = (await db.execute(
        select(TelemetrySignalRule).where(TelemetrySignalRule.name == rule.name)
    )).scalars().first()
    if existing_rule:
        raise HTTPException(status_code=400, detail=f"Rule '{rule.name}' already exists")
 
    new_rule = TelemetrySignalRule(
        name=rule.name,
        highthreshold=rule.highthreshold,
        lowthreshold=rule.lowthreshold,
        openvalue=rule.openvalue,
        closevalue=rule.closevalue,
        initialseverity=rule.initialseverity,
        affectedentity=rule.affectedentity,
        description=rule.description,
        warmup=rule.warmup,
        cooldown=rule.cooldown,  
    )

    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)

    return StatefulSyslogRuleRead(
        id=new_rule.id,
        name=new_rule.name,
        highthreshold=new_rule.highthreshold,
        lowthreshold=new_rule.lowthreshold,
        openvalue=new_rule.openvalue,
        closevalue=new_rule.closevalue,
        initialseverity=new_rule.initialseverity,
        affectedentity=new_rule.affectedentity,
        description=new_rule.description,
        warmup=new_rule.warmup,
        cooldown=new_rule.cooldown, 
    )


@router.put("/{rule_name}", response_model=TelemetrySignalRuleRead)
async def update_telemetry_signal_rule(
    rule_name: str,
    rule: TelemetrySignalRuleBase,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    from app.syslogs.mnemonics import Mnemonic

    db_rule = (await db.execute(
        select(TelemetrySignalRule).where(TelemetrySignalRule.name == rule_name)
    )).scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
 
    db_rule.name = rule.name
    db_rule.highthreshold = rule.highthreshold
    db_rule.lowthreshold = rule.lowthreshold
    db_rule.openvalue = rule.openvalue
    db_rule.closevalue = rule.closevalue
    db_rule.initialseverity = rule.initialseverity
    db_rule.affectedentity = rule.affectedentity
    db_rule.description = rule.description
    db_rule.warmup = rule.warmup
    db_rule.cooldown = rule.cooldown 

    await db.commit()
    await db.refresh(db_rule)

    return TelemetrySignalRuleRead(
        id=db_rule.id,
        name=db_rule.name,
        highthreshold=db_rule.highthreshold,
        lowthreshold=db_rule.lowthreshold,
        openvalue=db_rule.openvalue,
        closevalue=db_rule.closevalue,
        initialseverity=db_rule.initialseverity,
        affectedentity=db_rule.affectedentity,
        description=db_rule.description,
        warmup=db_rule.warmup,
        cooldown=db_rule.cooldown,
    )


@router.delete("/{rule_name}", status_code=204)
async def delete_telemetry_signal_rule(
    rule_name: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    db_rule = (await db.execute(
        select(TelemetrySignalRule).where(TelemetrySignalRule.name == rule_name)
    )).scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(db_rule)
    await db.commit()
