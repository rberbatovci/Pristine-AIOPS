from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, JSON, Text
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from typing import Optional, Any, List

from app.devices.models import Device
from app.db.session import Base, get_db
from app.syslogs.services import mnemonic_rules_association

router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class StatefulSyslogRule(Base):
    __tablename__ = "stateful_syslog_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    opensignalmnemonic_id = Column(Integer, ForeignKey('mnemonics.id'))
    closesignalmnemonic_id = Column(Integer, ForeignKey('mnemonics.id'))
    opensignalmnemonic = relationship('Mnemonic', foreign_keys=[opensignalmnemonic_id], backref='open_rules')
    closesignalmnemonic = relationship('Mnemonic', foreign_keys=[closesignalmnemonic_id], backref='close_rules')
    opensignaltag = Column(String(255), nullable=False)
    opensignalvalue = Column(String(255), nullable=False)
    closesignaltag = Column(String(255), nullable=False)
    closesignalvalue = Column(String(255), nullable=False)
    initialseverity = Column(String(255), nullable=False)
    affectedentity = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=False)
    warmup = Column(Integer, nullable=False)
    cooldown = Column(Integer, nullable=False)

    mnemonics = relationship(
        'Mnemonic',
        secondary=mnemonic_rules_association,
        back_populates='rules'
    )

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

class StatefulSyslogRule(StatefulSyslogRuleBase):
    id: int

    class Config:
        from_attributes = True

class StatefulSyslogRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

# ======================
# API Routes
# ======================
@router.post("/syslogs/statefulrules/", response_model=StatefulSyslogRule)
async def create_stateful_rule(rule: StatefulSyslogRuleBase, db: AsyncSession = Depends(get_db)):
    # Fetch mnemonics
    open_mnemonic = (
        await db.execute(select(Mnemonic).where(Mnemonic.name == rule.opensignalmnemonic))
    ).scalars().first()
    if not open_mnemonic:
        raise HTTPException(status_code=400, detail=f"Open signal mnemonic '{rule.opensignalmnemonic}' does not exist.")

    close_mnemonic = (
        await db.execute(select(Mnemonic).where(Mnemonic.name == rule.closesignalmnemonic))
    ).scalars().first()
    if not close_mnemonic:
        raise HTTPException(status_code=400, detail=f"Close signal mnemonic '{rule.closesignalmnemonic}' does not exist.")


    # Create rule
    db_rule = StatefulSyslogRule(
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
    )

    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)

    # Eagerly load relationships to avoid MissingGreenlet error
    result = await db.execute(
        select(StatefulSyslogRule)
        .options(
            selectinload(StatefulSyslogRule.opensignalmnemonic),
            selectinload(StatefulSyslogRule.closesignalmnemonic),
        )
        .where(StatefulSyslogRule.id == db_rule.id)
    )
    db_rule = result.scalars().first()

    # Manually build the response to match the expected schema
    return {
        "id": db_rule.id,
        "name": db_rule.name,
        "opensignaltag": db_rule.opensignaltag,
        "opensignalvalue": db_rule.opensignalvalue,
        "closesignaltag": db_rule.closesignaltag,
        "closesignalvalue": db_rule.closesignalvalue,
        "initialseverity": db_rule.initialseverity,
        "affectedentity": db_rule.affectedentity,
        "description": db_rule.description,
        "warmup": db_rule.warmup,
        "cooldown": db_rule.cooldown,
        "opensignalmnemonic": db_rule.opensignalmnemonic.name,
        "closesignalmnemonic": db_rule.closesignalmnemonic.name,
    }

@router.get("/syslogs/statefulrules/brief/", response_model=List[StatefulSyslogRuleBrief])
async def get_stateful_syslog_rules_brief(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StatefulSyslogRule.id, StatefulSyslogRule.name))
    return [{"id": r[0], "name": r[1]} for r in result.all()]

@router.delete("/syslogs/statefulrules/{rule_name}", status_code=204)
async def delete_stateful_syslog_rule(rule_name: str, session: AsyncSession = Depends(get_db)):

    result = await session.execute(
        select(StatefulSyslogRule)
        .options(
            selectinload(StatefulSyslogRule.opensignalmnemonic),
            selectinload(StatefulSyslogRule.closesignalmnemonic)
        )
        .where(StatefulSyslogRule.name == rule_name)
    )

    rule = result.scalars().first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await session.delete(rule)
    await session.commit()

    return {"detail": f"Rule '{rule_name}' deleted successfully"}

@router.put("/syslogs/statefulrules/{rule_name}", response_model=StatefulSyslogRule)
async def update_stateful_syslog_rule(rule_name: str, rule: StatefulSyslogRuleBase, db: AsyncSession = Depends(get_db)):

    result = await db.execute(
        select(StatefulSyslogRule).where(StatefulSyslogRule.name == rule_name)
    )
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Stateful Syslog Rule not found")

    open_mnemonic_result = await db.execute(
        select(Mnemonic).where(Mnemonic.name == rule.opensignalmnemonic)
    )
    open_mnemonic = open_mnemonic_result.scalars().first()
    if not open_mnemonic:
        raise HTTPException(
            status_code=400,
            detail=f"Open signal mnemonic '{rule.opensignalmnemonic}' does not exist."
        )

    close_mnemonic_result = await db.execute(
        select(Mnemonic).where(Mnemonic.name == rule.closesignalmnemonic)
    )
    close_mnemonic = close_mnemonic_result.scalars().first()
    if not close_mnemonic:
        raise HTTPException(
            status_code=400,
            detail=f"Close signal mnemonic '{rule.closesignalmnemonic}' does not exist."
        )

    db_rule.name = rule.name
    db_rule.opensignalmnemonic = rule.opensignalmnemonic
    db_rule.closesignalmnemonic = rule.closesignalmnemonic
    db_rule.opensignaltag = rule.opensignaltag
    db_rule.opensignalvalue = rule.opensignalvalue
    db_rule.closesignaltag = rule.closesignaltag
    db_rule.closesignalvalue = rule.closesignalvalue
    db_rule.initialseverity = rule.initialseverity
    db_rule.affectedentity = rule.affectedentity
    db_rule.description = rule.description
    db_rule.warmup = rule.warmup
    db_rule.cooldown = rule.cooldown

    db_rule.mnemonics = [open_mnemonic, close_mnemonic]

    await db.commit()
    await db.refresh(db_rule)

    return db_rule

@router.get("/syslogs/statefulrules/{rule_name}", response_model=StatefulSyslogRuleBase)
async def get_rule(rule_name: str, db: AsyncSession = Depends(get_db)):
    
    stmt = (
        select(StatefulSyslogRule)
        .options(
            selectinload(StatefulSyslogRule.opensignalmnemonic),
            selectinload(StatefulSyslogRule.closesignalmnemonic),
        )
        .where(StatefulSyslogRule.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return StatefulSyslogRuleBase(
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