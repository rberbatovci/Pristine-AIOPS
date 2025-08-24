# mnemonics.py

from typing import Optional, List
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import relationship, selectinload
from app.db.session import Base, get_db
from app.syslogs.services import mnemonic_rules_association
from pydantic import BaseModel
from .rules import StatefulSyslogRule, StatefulSyslogRuleBase
from app.syslogs.events import Syslog
from app.syslogs.regex import RegEx, RegExBrief  

router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class Mnemonic(Base):
    __tablename__ = 'mnemonics'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(30), unique=True, index=True)
    level = Column(Integer, nullable=True, default=None)
    severity = Column(String(15), nullable=True, default=None)
    alert = Column(Boolean, default=False)
    
    regexes = relationship('RegEx', secondary='mnemonic_regex', backref='mnemonics')
    rules = relationship(
        'StatefulSyslogRule',
        secondary=mnemonic_rules_association,
        back_populates='mnemonics'
    )

    def __str__(self):
        return self.name

# ======================
# Pydantic Schemas
# ======================

class MnemonicBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class MnemonicBase(BaseModel):
    id: int
    name: str
    level: Optional[int] = None
    severity: Optional[str] = None
    alert: bool
    regexes: List[str] = []

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj):
        # Convert SQLAlchemy RegEx objects to their names
        data = {
            "id": obj.id,
            "name": obj.name,
            "level": obj.level,
            "severity": obj.severity,
            "alert": obj.alert,
            "regexes": [r.name for r in getattr(obj, "regexes", [])]
        }
        return cls(**data)


# ======================
# Routes
# ======================

@router.get("/syslogs/mnemonics/", response_model=list[MnemonicBrief])
async def read_mnemonics_light(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mnemonic.id, Mnemonic.name).offset(skip).limit(limit)
    )
    mnemonics = result.all() 

    return [MnemonicBrief(id=m[0], name=m[1]) for m in mnemonics]


@router.get("/syslogs/mnemonics/{mnemonic_name}/", response_model=MnemonicBase)
async def read_mnemonic_by_name(mnemonic_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mnemonic)
        .where(Mnemonic.name == mnemonic_name)
        .options(selectinload(Mnemonic.regexes))
    )
    db_mnemonic = result.scalars().first()
    if not db_mnemonic:
        raise HTTPException(status_code=404, detail="Mnemonic not found")
    
    return MnemonicBase.from_orm(db_mnemonic)


@router.put("/syslogs/update/mnemonics/{mnemonic_name}", response_model=MnemonicBase)
async def update_mnemonic_by_name(mnemonic_name: str, mnemonic_update: MnemonicBase, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mnemonic)
        .where(Mnemonic.name == mnemonic_name)
        .options(selectinload(Mnemonic.regexes))
    )
    db_mnemonic = result.scalars().first()
    if db_mnemonic is None:
        raise HTTPException(status_code=404, detail="Mnemonic not found")

    # Update regexes
    if mnemonic_update.regexes is not None:
        result_regex = await db.execute(
            select(RegEx).where(RegEx.name.in_(mnemonic_update.regexes))
        )
        regexes = result_regex.scalars().all()
        db_mnemonic.regexes.clear()
        db_mnemonic.regexes.extend(regexes)

    await db.commit()
    await db.refresh(db_mnemonic)

    return MnemonicBase.from_orm(db_mnemonic)