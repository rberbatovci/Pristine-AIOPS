# tags.py

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Column, String, ARRAY, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import Base, get_db
from sqlalchemy.orm import relationship
from app.traps.services import trap_oid_tags
from typing import Optional, List
from app.auth.keycloak import get_current_user, require_admin

# Router instance
router = APIRouter(
    prefix="/api/traps/tags",
    tags=["traps,tags"],
)

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

def get_unique_terms(index: str, field: str, size: int = 1000) -> List[str]:
    try:
        response = opensearch_client.search(
            index=index,
            size=0,
            body={
                "aggs": {
                    "unique_terms": {
                        "terms": {
                            "field": field,
                            "size": size
                        }
                    }
                }
            }
        )
        buckets = response["aggregations"]["unique_terms"]["buckets"]
        return [bucket["key"] for bucket in buckets]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting terms: {str(e)}")

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
    name: Optional[str] = None
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

@router.get("/", response_model=list[TagBrief])
async def get_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Tag).offset(skip).limit(limit))
    tags = result.scalars().all()
    return tags

@router.get("/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate"), user: dict = Depends(get_current_user)):
    # Determine actual field path for aggregation
    if field in TOP_LEVEL_FIELDS:
        field_path = field
    else:
        field_path = f"content.{field}"

    try:
        return get_unique_terms(index="traps", field=field_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{name}", response_model=TagSchema)
async def get_tag_by_name(name: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Tag).where(Tag.name == name))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

@router.post("/", response_model=TagSchema, status_code=201)
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    async with db.begin():
        new_tag = Tag(name=tag.name, oids=tag.oids or [])
        db.add(new_tag)

    await db.commit()
    await db.refresh(new_tag)
    return new_tag

@router.patch("/{name}", response_model=TagSchema)
async def update_tag(
    name: str,
    tag: TagUpdate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    update_data = {}

    # ✅ Only include fields that were sent (PATCH behavior)
    if tag.oids is not None:
        update_data["oids"] = tag.oids

    if tag.name is not None:
        update_data["name"] = tag.name

    # ❗ If nothing to update
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    async with db.begin():
        stmt = (
            update(Tag)
            .where(Tag.name == name)
            .values(**update_data)
        )
        result = await db.execute(stmt)

    # Check if anything was updated
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Fetch updated object
    result = await db.execute(select(Tag).where(Tag.name == update_data.get("name", name)))
    updated = result.scalar_one()

    return TagSchema.from_orm(updated)

@router.delete("/{name}", status_code=204)
async def delete_tag(name: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    async with db.begin():
        result = await db.execute(select(Tag).where(Tag.name == name))
        tag = result.scalar_one_or_none()
        
        require_admin(user)
        if not tag:
            raise HTTPException(404, "Tag not found")
        await db.delete(tag)

    return
