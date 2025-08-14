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
from app.syslogs.regex import RegEx

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
class MnemonicSyslogBase(BaseModel):
    id: Optional[int]
    name: str
    level: Optional[int] = None
    severity: Optional[str] = None
    alert: Optional[bool] = False


class MnemonicSyslog(MnemonicSyslogBase):
    regexes: Optional[List[str]] = None
    rules: Optional[List[StatefulSyslogRuleBase]] = None

    class Config:
        orm_mode = True
        
    @classmethod
    def from_orm(cls, obj):
        # Convert RegEx objects to their names
        if obj.regexes is not None:
            obj.regexes = [regex.name for regex in obj.regexes]
        return super().from_orm(obj)

class MnemonicResponse(MnemonicSyslogBase):
    regexes: Optional[List[str]] = None
    rules: Optional[List[StatefulSyslogRuleBase]] = None

    class Config:
        orm_mode = True

    @staticmethod
    def from_db_model(db_model: Mnemonic):
        return MnemonicResponse(
            id=db_model.id,
            name=db_model.name,
            level=db_model.level,
            severity=db_model.severity,
            alert=db_model.alert,
            regexes=[regex.name for regex in db_model.regexes],
            rules=db_model.rules
        )


# ======================
# Redis Helpers
# ======================
def updated_mnemonic_in_redis(mnemonic_obj: Mnemonic):
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    key = f"syslogs:mnemonics:{mnemonic_obj.id}"

    r.hset(key, mapping={
        "id": mnemonic_obj.id,
        "name": mnemonic_obj.name,
        "severity": mnemonic_obj.severity or "",
        "regexes": ",".join([r.name for r in mnemonic_obj.regexes]),
        "rules": ",".join([r.name for r in mnemonic_obj.rules]),
    })
    r.sadd("syslogs:mnemonics:all", mnemonic_obj.id)


def sync_mnemonics_to_redis():
    conn = psycopg2.connect(
        dbname="fpristine",
        user="PristineAdmin",
        password="PristinePassword",
        host="postgresql"
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    r = redis.Redis(host='redis', port=6379, decode_responses=True)

    # Clear existing mnemonic keys
    for key in r.scan_iter("syslogs:mnemonics:*"):
        r.delete(key)
    r.delete("syslogs:mnemonics:all")

    cursor.execute("SELECT * FROM mnemonics;")
    mnemonics = cursor.fetchall()

    for row in mnemonics:
        key = f"syslogs:mnemonics:{row['id']}"
        r.hset(key, mapping=row)
        r.sadd("syslogs:mnemonics:all", row['id'])

    conn.close()


# ======================
# Routes
# ======================
@router.post("/syslogs/mnemonics/syncToRedis/")
def sync_mnemonics():
    try:
        sync_mnemonics_to_redis()
        return {"message": "Mnemonic rules synchronized successfully to Redis"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/syslogs/mnemonics/", response_model=list[MnemonicResponse])
async def read_mnemonics(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mnemonic)
        .options(selectinload(Mnemonic.regexes))
        .options(selectinload(Mnemonic.rules))
        .offset(skip)
        .limit(limit)
    )
    mnemonics = result.scalars().all()
    return [MnemonicResponse.from_db_model(m) for m in mnemonics]


@router.get("/syslogs/mnemonics/{mnemonic_name}/", response_model=MnemonicSyslog)
async def read_mnemonic_by_name(mnemonic_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mnemonic)
        .where(Mnemonic.name == mnemonic_name)
        .options(
            selectinload(Mnemonic.regexes),
            selectinload(Mnemonic.rules),
        )
    )
    db_mnemonic = result.scalars().first()
    if not db_mnemonic:
        raise HTTPException(status_code=404, detail="Mnemonic not found")
    return db_mnemonic


@router.put("/syslogs/update/mnemonics/{mnemonic_name}", response_model=MnemonicSyslog)
async def update_mnemonic_by_name(mnemonic_name: str, mnemonic_update: MnemonicSyslog, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Mnemonic)
        .where(Mnemonic.name == mnemonic_name)
        .options(selectinload(Mnemonic.regexes))
        .options(selectinload(Mnemonic.rules))
    )
    db_mnemonic = result.scalars().first()
    if db_mnemonic is None:
        raise HTTPException(status_code=404, detail="Mnemonic not found")

    # Update regexes
    if mnemonic_update.regexes is not None:
        result_regex = await db.execute(select(RegEx).where(RegEx.name.in_(mnemonic_update.regexes)))
        regexes = result_regex.scalars().all()
        db_mnemonic.regexes.clear()
        db_mnemonic.regexes.extend(regexes)

    # Update rules
    if mnemonic_update.rules is not None:
        rule_names = [rule.name for rule in mnemonic_update.rules]
        result_rules = await db.execute(select(StatefulSyslogRule).where(StatefulSyslogRule.name.in_(rule_names)))
        rules = result_rules.scalars().all()
        db_mnemonic.rules.clear()
        db_mnemonic.rules.extend(rules)

    # Update other fields
    update_data = mnemonic_update.dict(exclude={"regexes", "rules"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_mnemonic, key, value)

    await db.commit()
    await db.refresh(db_mnemonic)

    updated_mnemonic_in_redis(db_mnemonic)
    return db_mnemonic
