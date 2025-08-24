# tags.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import Base, get_db
from sqlalchemy import Column, String, ARRAY
from sqlalchemy.orm import relationship
from app.traps.services import trap_oid_tags
from typing import Optional, List

# Router instance
router = APIRouter()

# ======================
# SQLAlchemy Model
# ======================
class Tag(Base):
    __tablename__ = "trapTags"

    name = Column(String(50), primary_key=True, index=True)
    oids = Column(ARRAY(String), nullable=True) 
    trapOids = relationship(
        "TrapOid",
        secondary=trap_oid_tags,
        back_populates="tags"
    )

# ======================
# Pydantic Schemas
# ======================
class TagBase(BaseModel):
    name: str
    oids: Optional[List[str]] = None

    class Config:
        from_attributes = True


class TagCreate(TagBase):
    """
    Schema for creating a tag.
    Both `name` and optional `oids` are provided.
    """
    pass


class TagSchema(TagBase):
    """
    Schema for reading/returning a tag.
    Includes name and oids.
    """
    pass


class TagUpdate(BaseModel):
    """
    Schema for updating an existing tag.
    Typically you allow only `oids` to be updated.
    """
    oids: Optional[List[str]] = None

    class Config:
        from_attributes = True

class TagDelete(BaseModel):
    name: str

class TagBrief(BaseModel):
    name: str

    class Config:
        from_attributes = True

class OIDTag(BaseModel):
    name: str

    class Config:
        orm_mode = True

# ======================
# API Routes
# ======================

@router.get("/traps/tags/", response_model=list[TagBrief])
async def get_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).offset(skip).limit(limit))
    tags = result.scalars().all()
    return tags

@router.get("/traps/tags/{name}", response_model=TagSchema)
async def get_tag_by_name(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).where(Tag.name == name))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

@router.post("/traps/tags/", response_model=TagSchema, status_code=201)
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        new_tag = Tag(name=tag.name, oids=tag.oids or [])
        db.add(new_tag)

    await db.commit()
    await db.refresh(new_tag)
    return new_tag

@router.put("/traps/tags/{name}", response_model=TagSchema)
async def update_tag(name: str, tag: TagUpdate, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        stmt = (
            update(Tag)
            .where(Tag.name == name)
            .values(oids=tag.oids)
        )
        await db.execute(stmt)

    result = await db.execute(select(Tag).where(Tag.name == name))
    updated = result.scalar_one_or_none()
    if not updated:
        raise HTTPException(404, "Tag not found")

    return TagSchema.from_orm(updated)

@router.delete("/traps/tags/{name}", status_code=204)
async def delete_tag(name: str, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()

        if not tag:
            raise HTTPException(404, "Tag not found")
        await db.delete(tag)

    return
