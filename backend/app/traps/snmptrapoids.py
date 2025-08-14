from app.db.session import Base, get_db
from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship, selectinload
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List, Dict, Any
import redis
import psycopg2
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
from app.traps.services import trap_oid_tags, trap_rules_association
from app.traps.tags import OIDTag
from datetime import datetime

# Router instance
router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class TrapOid(Base):
    __tablename__ = "snmp_trap_oids"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    value = Column(String(255), nullable=False)
    alert = Column(Boolean, default=False)
    tags = relationship(
        'Tag',
        secondary=trap_oid_tags,
        back_populates="trapOids"
    )
    rules = relationship(
        'StatefulTrapRule', secondary=trap_rules_association, back_populates="traps"
    )

    def __str__(self):
        return self.name

# ======================
# Pydantic Schemas
# ======================
#class TrapOid(BaseModel):
#    id: Optional[int] = None
#    name: Optional[str]
#    value: Optional[str] = None
#    tags: Optional[List[OIDTag]] = []
#    rules: Optional[List[str]] = []

class TrapOidBrief(BaseModel):
    id: int
    name: Optional[str]
    value: str
    tags: List[OIDTag] = []
    alert: Optional[bool] = False

    class Config:
        orm_mode = True

class TrapOidUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None

class TrapBase(BaseModel):
    content: dict
    device: str

class Trap(TrapBase):
    id: int
    tags: Optional[Dict[str, Any]] = None
    signal: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    device: str
    trapOid: Optional[str]

    class Config:
        from_attributes = True

# ======================
# Redis Helpers
# ======================
def sync_snmp_trap_oids_to_redis():
    conn = psycopg2.connect(
        dbname="fpristine",
        user="PristineAdmin",
        password="PristinePassword",
        host="postgresql"
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    r = redis.Redis(host='redis', port=6379, decode_responses=True)

    for key in r.scan_iter("traps:oid:*"):
        r.delete(key)
    r.delete("traps:oid:all")

    cursor.execute("SELECT * FROM snmp_trap_oids;")
    rows = cursor.fetchall()

    for row in rows:
        key = f"traps:oid:{row['id']}"
        r.hset(key, mapping={
            'id': row['id'],
            'name': row['name'] or '',
            'tags': ','.join(row['tags']) if row['tags'] else ''
        })
        r.sadd("traps:oid:all", row['id'])

    conn.close()

# ======================
# Routes
# ======================
@router.post("/snmptraps/snmpTrapOids/syncToRedis/")
def sync_snmpTrapOids():
    try:
        sync_snmp_trap_oids_to_redis()
        return {"message": "SNMP Trap OIDs synchronized successfully to Redis"}
    except Exception as e:
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/traps/trapOids/", response_model=list[TrapOidBrief])
async def read_snmpTrapOids(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrapOid)
        .options(selectinload(TrapOid.tags))
        .offset(skip)
        .limit(limit)
    )
    snmpTrapOids = result.scalars().all()
    
    return snmpTrapOids

@router.get("/traps/trapOids/{trap_oid_name}", response_model=dict)
async def get_trap_oid_by_name(trap_oid_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrapOid)
        .options(
            selectinload(TrapOid.rules),
            selectinload(TrapOid.tags)
        )
        .where(TrapOid.name == trap_oid_name)
    )
    trap_oid = result.scalars().first()
    if not trap_oid:
        raise HTTPException(status_code=404, detail="TrapOid not found")

    return {
        "id": trap_oid.id,
        "name": trap_oid.name,
        "value": trap_oid.value,
        "alert": trap_oid.alert,
        "tags": [tag.name for tag in trap_oid.tags],
    }

@router.patch("/traps/trapOids/{trap_oid_name}", response_model=TrapOidBrief)
async def update_trap_oid_by_name(
    trap_oid_name: str,
    trap_oid_update: TrapOidUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TrapOid)
        .options(selectinload(TrapOid.rules), selectinload(TrapOid.tags))
        .filter(TrapOid.name == trap_oid_name)
    )
    trap_oid = result.scalars().first()
    if not trap_oid:
        raise HTTPException(status_code=404, detail="TrapOid not found")

    if trap_oid_update.tags is not None:
        tag_names = trap_oid_update.tags

        tags_result = await db.execute(select(TagModel).where(TagModel.name.in_(tag_names)))
        tag_objs = tags_result.scalars().all()

        trap_oid.tags = tag_objs

    db.add(trap_oid)
    await db.commit()
    await db.refresh(trap_oid)

    try:
        r = redis.Redis(host='redis', port=6379, decode_responses=True)
        redis_key = f"traps:oid:{trap_oid.id}"
        r.hset(redis_key, mapping={
            'id': trap_oid.id,
            'name': trap_oid.name or '',
            'tags': ','.join(trap_oid.tags) if trap_oid.tags else ''
        })
        r.sadd("traps:oid:all", trap_oid.id)
    except Exception as e:
        print(f"Failed to update Redis: {e}")

    return trap_oid