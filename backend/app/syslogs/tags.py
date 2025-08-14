# tags.py

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import Base, get_db

# Router instance
router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class SyslogTag(Base):
    __tablename__ = 'syslogTags'

    name = Column(String(50), primary_key=True, index=True)

    def __str__(self):
        return self.name

# ======================
# Pydantic Schemas
# ======================
class TagBase(BaseModel):
    name: str

    class Config:
        from_attributes = True

class TagCreate(TagBase):
    pass

class TagSchema(TagBase):
    pass

# ======================
# API Routes
# ======================
@router.get("/syslogs/tags/", response_model=list[TagSchema])
async def get_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogTag).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/syslogs/tags/{tag_name}", response_model=TagSchema)
async def get_tag_by_name(tag_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogTag).where(SyslogTag.name == tag_name))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

@router.post("/syslogs/tags/", response_model=TagSchema)
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db)):
    db_tag = SyslogTag(name=tag.name)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag

@router.delete("/syslogs/tags/{tag_name}")
async def delete_tag(tag_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogTag).where(SyslogTag.name == tag_name))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    await db.delete(tag)
    await db.commit()
    
    return {"message": f"Tag '{tag_name}' deleted successfully"}
