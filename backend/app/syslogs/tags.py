# tags.py

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Column, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import Base, get_db
from app.auth.keycloak import get_current_user, require_admin
from .statistics import TOP_LEVEL_FIELDS

# Router instance
router = APIRouter(
    prefix="/api/syslogs/tags",
    tags=["syslogs,tags"],
)

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
        logger.exception("Error during OpenSearch aggregation")
        raise HTTPException(status_code=500, detail=f"Error getting terms: {str(e)}")

# ======================
# API Routes
# ======================
@router.get("/", response_model=list[TagSchema])
async def get_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(SyslogTag).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate"), user: dict = Depends(get_current_user)):
    # Determine actual field path for aggregation
    if field in TOP_LEVEL_FIELDS:
        field_path = field
    else:
        field_path = f"tags.{field}"

    try:
        return get_unique_terms(index="syslogs", field=field_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{tag_name}", response_model=TagSchema)
async def get_tag_by_name(tag_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogTag).where(SyslogTag.name == tag_name))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

@router.post("/", response_model=TagSchema)
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db)):
    db_tag = SyslogTag(name=tag.name)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag

@router.delete("/{tag_name}")
async def delete_tag(tag_name: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(SyslogTag).where(SyslogTag.name == tag_name))
    tag = result.scalar_one_or_none()

    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")

    require_admin(user)

    await db.delete(tag)
    await db.commit()
    
    return {"message": f"Tag '{tag_name}' deleted successfully"}
