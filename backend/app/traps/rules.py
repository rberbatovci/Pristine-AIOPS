# traps/stateful_rules.py

from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, ForeignKey, JSON, Text, select
from sqlalchemy.orm import relationship, selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.auth.keycloak import get_current_user, require_admin
from app.traps.snmptrapoids import TrapOid

from app.db.session import Base, get_db
from app.traps.services import trap_rules_association

router = APIRouter(
    prefix="/api/traps/signals/rules/stateful",
    tags=["traps, signals, rules", "stateful"],
)

# ======================
# SQLAlchemy Model
# ======================
class StatefulTrapRule(Base):
    __tablename__ = "stateful_trap_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)

    opensignaltrap_id = Column(Integer, ForeignKey("snmp_trap_oids.id"))
    closesignaltrap_id = Column(Integer, ForeignKey("snmp_trap_oids.id"))

    opensignaltrap = relationship("TrapOid", foreign_keys=[opensignaltrap_id], backref="open_rules")
    closesignaltrap = relationship("TrapOid", foreign_keys=[closesignaltrap_id], backref="close_rules")

    opensignaltag = Column(String(255), nullable=True)
    opensignalvalue = Column(String(255), nullable=True)
    closesignaltag = Column(String(255), nullable=True)
    closesignalvalue = Column(String(255), nullable=True)

    initialseverity = Column(String(255), nullable=False)
    affectedentity = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=False)
    warmup = Column(Integer, nullable=False)
    cooldown = Column(Integer, nullable=False)

    traps = relationship(
        "TrapOid",
        secondary=trap_rules_association,
        back_populates="rules"
    )


# ======================
# Pydantic Schemas
# ======================
class StatefulTrapRuleBase(BaseModel):
    name: str
    opensignaltrap: Optional[str] = None
    closesignaltrap: Optional[str] = None
    opensignaltag: Optional[str] = None
    opensignalvalue: Optional[str] = None
    closesignaltag: Optional[str] = None
    closesignalvalue: Optional[str] = None
    initialseverity: str
    affectedentity: Optional[List[Any]] = None
    description: str
    warmup: int
    cooldown: int


class StatefulTrapRuleCreate(StatefulTrapRuleBase):
    """Schema for creating/updating trap rules."""
    pass


class StatefulTrapRuleResponse(StatefulTrapRuleBase):
    id: int

    class Config:
        from_attributes = True


class StatefulTrapRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# ======================
# Routes
# ======================

@router.get("/", response_model=List[StatefulTrapRuleBrief])
async def get_stateful_trap_rules(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(StatefulTrapRule.id, StatefulTrapRule.name))
    return [{"id": r[0], "name": r[1]} for r in result.all()]


@router.get("/{rule_name}", response_model=StatefulTrapRuleResponse)
async def get_stateful_trap_rule(rule_name: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    stmt = (
        select(StatefulTrapRule)
        .options(
            selectinload(StatefulTrapRule.opensignaltrap),
            selectinload(StatefulTrapRule.closesignaltrap),
        )
        .where(StatefulTrapRule.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()

    if not db_rule:
        raise HTTPException(status_code=404, detail=f"Trap rule '{rule_name}' not found")

    return StatefulTrapRuleResponse(
        id=db_rule.id,
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
    )


@router.post("/", response_model=StatefulTrapRuleResponse, status_code=201)
async def create_stateful_trap_rule(rule: StatefulTrapRuleCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    # Validate referenced trap OIDs
    open_trap = None
    close_trap = None

    if rule.opensignaltrap:
        result = await db.execute(select(TrapOid).where(TrapOid.name == rule.opensignaltrap))
        open_trap = result.scalars().first()
        if not open_trap:
            raise HTTPException(status_code=400, detail=f"Open signal trap '{rule.opensignaltrap}' not found")

    if rule.closesignaltrap:
        result = await db.execute(select(TrapOid).where(TrapOid.name == rule.closesignaltrap))
        close_trap = result.scalars().first()
        if not close_trap:
            raise HTTPException(status_code=400, detail=f"Close signal trap '{rule.closesignaltrap}' not found")

    # Create DB object
    db_rule = StatefulTrapRule(
        name=rule.name,
        opensignaltrap=open_trap,
        closesignaltrap=close_trap,
        opensignaltag=rule.opensignaltag,
        opensignalvalue=rule.opensignalvalue,
        closesignaltag=rule.closesignaltag,
        closesignalvalue=rule.closesignalvalue,
        initialseverity=rule.initialseverity,
        affectedentity=rule.affectedentity,
        description=rule.description,
        warmup=rule.warmup,
        cooldown=rule.cooldown,
    )

    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)

    return StatefulTrapRuleResponse(
        id=db_rule.id,
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
    )


@router.delete("/{rule_name}", status_code=204)
async def delete_stateful_trap_rule(rule_name: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(
        select(StatefulTrapRule).where(StatefulTrapRule.name == rule_name)
    )
    db_rule = result.scalars().first()

    if not db_rule:
        raise HTTPException(status_code=404, detail=f"Trap rule '{rule_name}' not found")

    await db.delete(db_rule)
    await db.commit()

    return {"detail": f"Trap rule '{rule_name}' deleted successfully"}

@router.put("/{rule_name}", response_model=StatefulTrapRuleResponse)
async def update_stateful_trap_rule(
    rule_name: str,
    rule: StatefulTrapRuleResponse,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    require_admin(user)

    from app.traps.snmptrapoids import TrapOid

    db_rule = (await db.execute(
        select(StatefulTrapRule).where(StatefulTrapRule.name == rule_name)
    )).scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    open_trap = (await db.execute(
        select(TrapOid).where(TrapOid.name == rule.opensignaltrap)
    )).scalars().first()
    if not open_trap:
        raise HTTPException(status_code=400, detail=f"Open trap '{rule.opensignaltrap}' not found")

    close_trap = (await db.execute(
        select(TrapOid).where(TrapOid.name == rule.closesignaltrap)
    )).scalars().first()
    if not close_trap:
        raise HTTPException(status_code=400, detail=f"Close trap '{rule.closesignaltrap}' not found")

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
    db_rule.opensignaltrap = open_trap
    db_rule.closesignaltrap = close_trap

    await db.commit()
    await db.refresh(db_rule)

    return StatefulTrapRuleResponse(
        id=db_rule.id,
        name=db_rule.name,
        opensignaltrap=open_trap.name if open_trap else None,
        closesignaltrap=close_trap.name if close_trap else None,
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
