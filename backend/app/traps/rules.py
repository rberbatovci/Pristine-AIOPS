
from app.db.session import Base, get_db
from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Text
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import relationship
from fastapi import APIRouter, Depends, HTTPException
from app.traps.services import trap_rules_association
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class StatefulTrapRule(Base):
    __tablename__ = "stateful_trap_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    opensignaltrap_id = Column(Integer, ForeignKey('snmp_trap_oids.id'))
    closesignaltrap_id = Column(Integer, ForeignKey('snmp_trap_oids.id'))
    opensignaltrap = relationship('TrapOid', foreign_keys=[opensignaltrap_id], backref='open_rules')
    closesignaltrap = relationship('TrapOid', foreign_keys=[closesignaltrap_id], backref='close_rules')
    opensignaltag = Column(String(255), nullable=False)
    opensignalvalue = Column(String(255), nullable=False)
    closesignaltag = Column(String(255), nullable=False)
    closesignalvalue = Column(String(255), nullable=False)
    initialseverity = Column(String(255), nullable=False)
    affectedentity = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=False)
    warmup = Column(Integer, nullable=False)
    cooldown = Column(Integer, nullable=False)

    traps = relationship(
        "TrapOid",
        secondary=trap_rules_association,
        back_populates='rules'
    )

# ======================
# Pydantic Schemas
# ======================
class StatefulTrapRulesSchema(BaseModel):
    id: int
    name: str
    open_signal_trap_id: int
    close_signal_trap_id: int
    open_signal_event_id: Optional[int]
    close_signal_event_id: Optional[int]
    affected_entity: Optional[List[int]]
    initialSeverity: Optional[str]
    description: Optional[str]
    warmUp: int
    coolDown: int

class StatefulTrapRuleBase(BaseModel):
    name: str
    opensignaltrap: Optional[str] = None
    closesignaltrap: Optional[str] = None
    opensignaltag: str
    opensignalvalue: str
    closesignaltag: str
    closesignalvalue: str
    initialseverity: str
    affectedentity: Optional[List[Any]] = None
    description: str
    warmup: int
    cooldown: int

class StatefulTrapRule(StatefulTrapRuleBase):
    id: Optional[int]

    class Config:
        from_attributes = True

class StatefulTrapRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class StatefulTrapRuleResponse(StatefulTrapRuleBase):
    id: int
    opensignaltrap: Optional[str]
    closesignaltrap: Optional[str]

    class Config:
        from_attributes = True

# ======================
# API Routes
# ======================
@router.get("/traps/statefulrules/", response_model=List[StatefulTrapRuleBrief])
async def get_stateful_trap_rules_brief(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrapRulesModel.id, TrapRulesModel.name))
    return [{"id": r[0], "name": r[1]} for r in result.all()]

@router.post("/traps/statefulrules/", response_model=StatefulTrapRuleResponse)
async def create_stateful_rule(rule: StatefulTrapRuleBase, db: AsyncSession = Depends(get_db)):
    try:
        # Fetch trap OIDs
        open_trapOid = (
            await db.execute(select(TrapOidModel).where(TrapOidModel.name == rule.opensignaltrap))
        ).scalars().first()
        if rule.opensignaltrap and not open_trapOid:
            raise HTTPException(status_code=400, detail=f"Open signal Trap '{rule.opensignaltrap}' does not exist.")

        close_trapOid = (
            await db.execute(select(TrapOidModel).where(TrapOidModel.name == rule.closesignaltrap))
        ).scalars().first()
        if rule.closesignaltrap and not close_trapOid:
            raise HTTPException(status_code=400, detail=f"Close signal Trap '{rule.closesignaltrap}' does not exist.")

        # Fetch devices by hostname
        devices = []
        if rule.device_hostnames:
            result = await db.execute(
                select(DeviceModel).where(DeviceModel.hostname.in_(rule.device_hostnames))
            )
            devices = result.scalars().all()

        # Create rule
        db_rule = TrapRulesModel(
            name = rule.name,
            opensignaltag = rule.opensignaltag,
            opensignalvalue = rule.opensignalvalue,
            closesignaltag = rule.closesignaltag,
            closesignalvalue = rule.closesignalvalue,
            initialseverity = rule.initialseverity,
            affectedentity = rule.affectedentity,
            description = rule.description,
            warmup = rule.warmup,
            cooldown = rule.cooldown,
            opensignaltrap = open_trapOid,
            closesignaltrap = close_trapOid,
            devices = devices
        )

        db.add(db_rule)
        await db.commit()
        await db.refresh(db_rule)

        result = await db.execute(
            select(TrapRulesModel)
            .options(
                selectinload(TrapRulesModel.opensignaltrap),
                selectinload(TrapRulesModel.closesignaltrap),
                selectinload(TrapRulesModel.devices),
            )
            .where(TrapRulesModel.id == db_rule.id)
        )
        db_rule = result.scalars().first()

        await save_statefulrules_to_file(db)
        await update_trap_rules_in_json(
            opensignaltrap_name=db_rule.opensignaltrap.name,
            closesignaltrap_name=db_rule.closesignaltrap.name,
            rule_name=db_rule.name
        )

        return StatefulTrapRuleResponse(
            id=db_rule.id,
            name=db_rule.name,
            opensignaltag=db_rule.opensignaltag,
            opensignalvalue=db_rule.opensignalvalue,
            closesignaltag=db_rule.closesignaltag,
            closesignalvalue=db_rule.closesignalvalue,
            initialseverity=db_rule.initialseverity,
            affectedentity=db_rule.affectedentity,
            description=db_rule.description,
            warmup=db_rule.warmup,
            cooldown=db_rule.cooldown,
            opensignaltrap=db_rule.opensignaltrap.name,
            closesignaltrap=db_rule.closesignaltrap.name,
            device_hostnames=[device.hostname for device in db_rule.devices],
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/traps/statefulrules/{rule_name}", response_model=StatefulTrapRuleBase)
async def get_rule(rule_name: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(TrapRulesModel)
        .options(
            selectinload(TrapRulesModel.opensignaltrap),
            selectinload(TrapRulesModel.closesignaltrap),
            selectinload(TrapRulesModel.devices),
        )
        .where(TrapRulesModel.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return StatefulTrapRuleBase(
        name=db_rule.name,
        opensignaltrap=db_rule.opensignaltrap.name if db_rule.opensignaltrap else None,
        closesignaltrap=db_rule.closesignaltrap.name if db_rule.closesignaltrap else None,
        opensignaltag=db_rule.opensignaltag,
        opensignalvalue=db_rule.opensignalvalue,
        closesignaltag=db_rule.closesignaltag,
        closesignalvalue=db_rule.closesignalvalue,
        initialseverity=db_rule.initialseverity,
        affectedentity=db_rule.affectedentity,
        description=db_rule.description,
        warmup=db_rule.warmup,
        cooldown=db_rule.cooldown,
        device_hostnames=[device.hostname for device in db_rule.devices] if db_rule.devices else [],
    )

@router.delete("/traps/statefulrules/{rule_name}", status_code=204)
async def delete_stateful_trap_rule(
    rule_name: str, 
    session: AsyncSession = Depends(get_db)
):
    result = await session.execute(
        select(TrapRulesModel)
        .options(
            selectinload(TrapRulesModel.opensignaltrap),
            selectinload(TrapRulesModel.closesignaltrap)
        )
        .where(TrapRulesModel.name == rule_name)
    )

    rule = result.scalars().first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await session.delete(rule)
    await session.commit()

    await remove_rule_from_json(rule.name)
    await remove_rule_from_snmpTrapOid(rule.name)

    return {"detail": f"Rule '{rule_name}' deleted successfully"}
