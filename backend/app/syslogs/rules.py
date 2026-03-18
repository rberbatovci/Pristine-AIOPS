from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, JSON, Text, Column, Integer, String, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import relationship, selectinload
from pydantic import BaseModel
from typing import Optional, Any, List
from app.auth.keycloak import get_current_user, require_admin

from app.db.session import Base, get_db
from app.syslogs.services import mnemonic_rules_association
#from app.syslogs.mnemonics import Mnemonic

statefulRules = APIRouter(
    prefix="/api/syslogs/signals/rules/stateful",
    tags=["syslogs, signals, rules", "stateful"],
)

severityLevel = APIRouter(
    prefix="/api/syslogs/signals/rules/severity",
    tags=["syslogs, signals, rules", "severity"],
)

# ======================
# SQLAlchemy Model
# ======================
class StatefulSyslogRule(Base):
    __tablename__ = "stateful_syslog_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)

    opensignalmnemonic_id = Column(Integer, ForeignKey('mnemonics.id'))
    closesignalmnemonic_id = Column(Integer, ForeignKey('mnemonics.id'))

    opensignalmnemonic = relationship(
        'Mnemonic',
        foreign_keys='StatefulSyslogRule.opensignalmnemonic_id',
        backref='open_rules'
    )
    closesignalmnemonic = relationship(
        'Mnemonic',
        foreign_keys='StatefulSyslogRule.closesignalmnemonic_id',
        backref='close_rules'
    )

    opensignaltag = Column(String(255), nullable=False)
    opensignalvalue = Column(String(255), nullable=False)
    closesignaltag = Column(String(255), nullable=False)
    closesignalvalue = Column(String(255), nullable=False)

    initialseverity = Column(String(255), nullable=False)
    affectedentity = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=False)
    warmup = Column(Integer, nullable=False)
    cooldown = Column(Integer, nullable=False)

    # ✅ define relationship here
    mnemonics = relationship(
        "Mnemonic",
        secondary=mnemonic_rules_association,
        back_populates="rules"
    )

class SyslogSeverity(Base):
    __tablename__ = "syslogsignalseverity"

    id = Column(Integer, primary_key=True, index=True)   
    number = Column(Integer, nullable=False)              
    severity = Column(String(15), nullable=False)      
    description = Column(String(255), nullable=False)

# ======================
# Pydantic Schemas
# ======================
class StatefulSyslogRuleBase(BaseModel):
    name: str
    opensignalmnemonic: Optional[str] = None
    closesignalmnemonic: Optional[str] = None
    opensignaltag: str
    opensignalvalue: str
    closesignaltag: str
    closesignalvalue: str
    initialseverity: str
    affectedentity: Optional[List[Any]] = None
    description: str
    warmup: int
    cooldown: int


class StatefulSyslogRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class StatefulSyslogRuleRead(StatefulSyslogRuleBase):
    id: int

    class Config:
        orm_mode = True

class SyslogSeveritySchema(BaseModel):
    number: int
    description: str

    class Config:
        orm_mode = True

# ======================
# Rules API Routes
# ======================

@statefulRules.get("/", response_model=List[StatefulSyslogRuleBrief])
async def get_stateful_syslog_rules_brief(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(StatefulSyslogRule.id, StatefulSyslogRule.name)
    )
    return [{"id": r[0], "name": r[1]} for r in result.all()]


@statefulRules.get("/{rule_name}", response_model=StatefulSyslogRuleRead)
async def get_stateful_syslog_rule(
    rule_name: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    stmt = (
        select(StatefulSyslogRule)
        .options(
            selectinload(StatefulSyslogRule.opensignalmnemonic),
            selectinload(StatefulSyslogRule.closesignalmnemonic),
            selectinload(StatefulSyslogRule.mnemonics),
        )
        .where(StatefulSyslogRule.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()

    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return StatefulSyslogRuleRead(
        id=db_rule.id,
        name=db_rule.name,
        opensignalmnemonic=db_rule.opensignalmnemonic.name if db_rule.opensignalmnemonic else None,
        closesignalmnemonic=db_rule.closesignalmnemonic.name if db_rule.closesignalmnemonic else None,
        opensignaltag=db_rule.opensignaltag,
        opensignalvalue=db_rule.opensignalvalue,
        closesignaltag=db_rule.closesignaltag,
        closesignalvalue=db_rule.closesignalvalue,
        initialseverity=db_rule.initialseverity,
        affectedentity=db_rule.affectedentity,
        description=db_rule.description,
        warmup=db_rule.warmup,
        cooldown=db_rule.cooldown,
    )

@statefulRules.post("/", response_model=StatefulSyslogRuleRead, status_code=201)
async def create_stateful_syslog_rule(
    rule: StatefulSyslogRuleBase,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    from app.syslogs.mnemonics import Mnemonic

    existing_rule = (await db.execute(
        select(StatefulSyslogRule).where(StatefulSyslogRule.name == rule.name)
    )).scalars().first()
    if existing_rule:
        raise HTTPException(status_code=400, detail=f"Rule '{rule.name}' already exists")

    open_mnemonic = (await db.execute(
        select(Mnemonic).where(Mnemonic.name == rule.opensignalmnemonic)
    )).scalars().first()
    if not open_mnemonic:
        raise HTTPException(status_code=400, detail=f"Open mnemonic '{rule.opensignalmnemonic}' not found")

    close_mnemonic = (await db.execute(
        select(Mnemonic).where(Mnemonic.name == rule.closesignalmnemonic)
    )).scalars().first()
    if not close_mnemonic:
        raise HTTPException(status_code=400, detail=f"Close mnemonic '{rule.closesignalmnemonic}' not found")

    new_rule = StatefulSyslogRule(
        name=rule.name,
        opensignaltag=rule.opensignaltag,
        opensignalvalue=rule.opensignalvalue,
        closesignaltag=rule.closesignaltag,
        closesignalvalue=rule.closesignalvalue,
        initialseverity=rule.initialseverity,
        affectedentity=rule.affectedentity,
        description=rule.description,
        warmup=rule.warmup,
        cooldown=rule.cooldown,
        opensignalmnemonic=open_mnemonic,
        closesignalmnemonic=close_mnemonic,
        mnemonics=[open_mnemonic, close_mnemonic],
    )

    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)

    return StatefulSyslogRuleRead(
        id=new_rule.id,
        name=new_rule.name,
        opensignalmnemonic=open_mnemonic.name,
        closesignalmnemonic=close_mnemonic.name,
        opensignaltag=new_rule.opensignaltag,
        opensignalvalue=new_rule.opensignalvalue,
        closesignaltag=new_rule.closesignaltag,
        closesignalvalue=new_rule.closesignalvalue,
        initialseverity=new_rule.initialseverity,
        affectedentity=new_rule.affectedentity,
        description=new_rule.description,
        warmup=new_rule.warmup,
        cooldown=new_rule.cooldown,
    )


@statefulRules.put("/{rule_name}", response_model=StatefulSyslogRuleRead)
async def update_stateful_syslog_rule(
    rule_name: str,
    rule: StatefulSyslogRuleBase,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    from app.syslogs.mnemonics import Mnemonic

    db_rule = (await db.execute(
        select(StatefulSyslogRule).where(StatefulSyslogRule.name == rule_name)
    )).scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    open_mnemonic = (await db.execute(
        select(Mnemonic).where(Mnemonic.name == rule.opensignalmnemonic)
    )).scalars().first()
    if not open_mnemonic:
        raise HTTPException(status_code=400, detail=f"Open mnemonic '{rule.opensignalmnemonic}' not found")

    close_mnemonic = (await db.execute(
        select(Mnemonic).where(Mnemonic.name == rule.closesignalmnemonic)
    )).scalars().first()
    if not close_mnemonic:
        raise HTTPException(status_code=400, detail=f"Close mnemonic '{rule.closesignalmnemonic}' not found")

    db_rule.name = rule.name
    db_rule.opensignaltag = rule.opensignaltag
    db_rule.opensignalvalue = rule.opensignalvalue
    db_rule.closesignaltag = rule.closesignaltag
    db_rule.closesignalvalue = rule.closesignalvalue
    db_rule.initialseverity = rule.initialseverity
    db_rule.affectedentity = rule.affectedentity
    db_rule.description = rule.description
    db_rule.warmup = rule.warmup
    db_rule.cooldown = rule.cooldown
    db_rule.opensignalmnemonic = open_mnemonic
    db_rule.closesignalmnemonic = close_mnemonic
    db_rule.mnemonics = [open_mnemonic, close_mnemonic]

    await db.commit()
    await db.refresh(db_rule)

    return StatefulSyslogRuleRead(
        id=db_rule.id,
        name=db_rule.name,
        opensignalmnemonic=open_mnemonic.name,
        closesignalmnemonic=close_mnemonic.name,
    )


@statefulRules.delete("/{rule_name}", status_code=204)
async def delete_stateful_syslog_rule(
    rule_name: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    db_rule = (await db.execute(
        select(StatefulSyslogRule).where(StatefulSyslogRule.name == rule_name)
    )).scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(db_rule)
    await db.commit()

# ======================
# Severity API Routes
# ======================
@severityLevel.get("/", response_model=SyslogSeveritySchema)
async def get_severity(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    

    result = await db.execute(select(SyslogSeverity))
    severity = result.scalar_one_or_none()
    if not severity:
        raise HTTPException(status_code=404, detail="Severity not found")

    return severity


@severityLevel.put("/", response_model=SyslogSeveritySchema)
async def update_severity(payload: SyslogSeveritySchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogSeverity))
    severity = result.scalar_one_or_none()
    if not severity:
        raise HTTPException(status_code=404, detail="Severity not found")
    
    require_admin(user)

    severity.number = payload.number
    severity.description = payload.description
    await db.commit()
    await db.refresh(severity)
    return severity