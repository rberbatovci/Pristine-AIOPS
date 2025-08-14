# regex.py

# ======================
# Imports
# ======================
from typing import Optional
from enum import Enum
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import redis
import psycopg2
from psycopg2.extras import RealDictCursor
from app.db.session import Base, get_db

router = APIRouter()

class MatchOptions(str, Enum):
    undefined = "undefined"
    search = "search"
    match = "match"

# ======================
# SQLAlchemy Model
# ======================
class RegEx(Base):
    __tablename__ = 'regex'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(25), unique=True, index=True)
    pattern = Column(String(255), nullable=True, default=None)
    matchfunction = Column(String(25), nullable=False, default='search')
    matchnumber = Column(Integer, nullable=True, default=None)
    groupnumber = Column(Integer, nullable=True, default=None)
    nomatch = Column(String(25), nullable=True, default="")
    tag = Column(String(50), ForeignKey('syslogTags.name'), nullable=True)

    def __str__(self):
        return self.name

# ======================
# Pydantic Schemas
# ======================
class RegExCreate(BaseModel):
    name: str
    pattern: str | None = None
    matchfunction: MatchOptions = MatchOptions.undefined
    matchnumber: int | None = None
    groupnumber: int | None = None
    nomatch: Optional[str]
    tag: str | None = None


class RegExUpdate(BaseModel):
    name: str | None = None
    pattern: str | None = None
    matchfunction: MatchOptions | None = None
    matchnumber: int | None = None
    groupnumber: int | None = None
    nomatch: str | None = None
    tag: str | None = None


class RegExResponse(BaseModel):
    id: int
    name: str
    pattern: Optional[str]
    matchfunction: MatchOptions
    matchnumber: Optional[int]
    groupnumber: Optional[int]
    nomatch: str
    tag: Optional[str]

    class Config:
        from_attributes = True


class RegExBrief(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True


# ======================
# Redis Helper Functions
# ======================
def add_regex_to_redis(regex_obj):
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    key = f"syslogs:regex:{regex_obj.id}"
    r.hset(key, mapping={
        "id": regex_obj.id,
        "name": regex_obj.name,
        "pattern": regex_obj.pattern,
        "matchfunction": regex_obj.matchfunction,
        "matchnumber": regex_obj.matchnumber,
        "groupnumber": regex_obj.groupnumber,
        "nomatch": regex_obj.nomatch,
        "tag": regex_obj.tag,
    })
    r.sadd("syslogs:regex:all", regex_obj.id)

def sync_regex_to_redis():
    conn = psycopg2.connect(
        dbname="fpristine",
        user="PristineAdmin",
        password="PristinePassword",
        host="postgresql"
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    r = redis.Redis(host='redis', port=6379, decode_responses=True)

    for key in r.scan_iter("syslogs:regex:*"):
        r.delete(key)
    r.delete("syslogs:regex:all")

    cursor.execute("SELECT * FROM regex;")
    regexes = cursor.fetchall()

    for row in regexes:
        key = f"syslogs:regex:{row['id']}"
        r.hset(key, mapping=row)
        r.sadd("syslogs:regex:all", row['id'])

    conn.close()

def delete_regex_from_redis(regex_id):
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    key = f"syslogs:regex:{regex_id}"
    r.delete(key)
    r.srem("syslogs:regex:all", regex_id)

# ======================
# API Routes
# ======================
@router.post("/syslogs/regex/syncToRedis/")
def sync_regex():
    try:
        sync_regex_to_redis()
        return {"message": "Regex rules synchronized successfully to Redis"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/syslogs/regex/", response_model=list[RegExBrief])
async def read_regex(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RegEx).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/syslogs/regex/{regex_name}", response_model=RegExResponse)
async def read_regex_by_name(regex_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RegEx).filter(RegEx.name == regex_name))
    db_regex = result.scalars().first()
    if not db_regex:
        raise HTTPException(status_code=404, detail="RegEx not found")
    return db_regex

@router.delete("/syslogs/regex/{regex_name}", response_model=dict)
async def delete_regex(regex_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RegEx).filter(RegEx.name == regex_name))
    db_regex = result.scalars().first()
    if not db_regex:
        raise HTTPException(status_code=404, detail="RegEx not found")

    regex_id = db_regex.id
    tag_name = db_regex.tag

    await db.delete(db_regex)
    await db.commit()

    delete_regex_from_redis(regex_id)
    response = {"regex_deleted": True, "tag_deleted": False}

    if tag_name:
        result = await db.execute(select(RegEx).filter(RegEx.tag == tag_name))
        remaining_regexes = result.scalars().all()
        if not remaining_regexes:
            db_tag_result = await db.scalar(select(models.SyslogTag).filter(models.SyslogTag.name == tag_name))
            if db_tag_result:
                await db.delete(db_tag_result)
                await db.commit()
                response["tag_deleted"] = True

    return response

@router.post("/syslogs/regex/", response_model=RegExResponse)
async def create_regex(regex: RegExCreate, db: AsyncSession = Depends(get_db)):
    db_regex = await db.scalar(select(RegEx).where(RegEx.name == regex.name))
    if db_regex:
        raise HTTPException(status_code=400, detail="RegEx name already exists")

    db_tag = None
    if regex.tag:
        db_tag_result = await db.scalar(select(models.SyslogTag).where(models.SyslogTag.name == regex.tag))
        if db_tag_result:
            db_tag = db_tag_result
        else:
            db_tag = models.SyslogTag(name=regex.tag)
            db.add(db_tag)
            await db.commit()
            await db.refresh(db_tag)

    db_regex_create = RegEx(**regex.dict())
    if db_tag:
        db_regex_create.tag = db_tag.name

    db.add(db_regex_create)
    await db.commit()
    await db.refresh(db_regex_create)

    add_regex_to_redis(db_regex_create)
    return db_regex_create

@router.put("/syslogs/regex/{regex_name}", response_model=RegExResponse)
async def update_regex(regex_name: str, regex_update: RegExUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RegEx).filter(RegEx.name == regex_name))
    db_regex = result.scalars().first()
    if not db_regex:
        raise HTTPException(status_code=404, detail="RegEx not found")

    for key, value in regex_update.dict(exclude_unset=True).items():
        if key == "tag":
            if value:
                db_tag_result = await db.scalar(select(models.SyslogTag).where(models.SyslogTag.name == value))
                db_tag = db_tag_result
                if not db_tag:
                    db_tag = models.SyslogTag(name=value)
                    db.add(db_tag)
                    await db.commit()
                    await db.refresh(db_tag)
                setattr(db_regex, key, db_tag.name)
            else:
                setattr(db_regex, key, None)
        else:
            setattr(db_regex, key, value)

    await db.commit()
    await db.refresh(db_regex)
    return db_regex
