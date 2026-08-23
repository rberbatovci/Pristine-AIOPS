from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    func
)
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel
from typing import Literal
from ..db.session import get_db
from .schemas import (
    UserPreferencesResponse,
    ThemeUpdate,
    TimezoneUpdate
)
from app.auth.keycloak import get_current_user

Base = declarative_base()
 
router = APIRouter(
    prefix="/api/users/me",
    tags=["User Preferences"],
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    # Keycloak user ID (JWT sub claim)
    keycloak_user_id = Column(String(255), unique=True, nullable=False, index=True)

    username = Column(String(255), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=True)

    # User preferences
    theme = Column(String(20), nullable=False, default="light")
    timezone = Column(String(100), nullable=False, default="UTC")
    language = Column(String(20), nullable=False, default="en")

    # Permissions
    is_active = Column(Boolean, default=True)
    is_staff = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


class UserPreferencesResponse(BaseModel):
    theme: Literal["light", "dark"]
    timezone: str

    class Config:
        from_attributes = True

class ThemeUpdate(BaseModel):
    theme: Literal["light", "dark"]

class TimezoneUpdate(BaseModel):
    timezone: str

async def get_or_create_user(
    db: AsyncSession,
    token_data: dict
):
    keycloak_user_id = token_data["sub"]

    result = await db.execute(
        select(User).where(
            User.keycloak_user_id == keycloak_user_id
        )
    )

    user = result.scalar_one_or_none()

    if user:
        return user

    user = User(
        keycloak_user_id=keycloak_user_id,
        username=token_data.get("preferred_username"),
        email=token_data.get("email"),
        theme="light",
        timezone="UTC"
    )

    db.add(user)

    await db.commit()
    await db.refresh(user)

    return user

@router.get("/preferences")
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user)
):
    user = await get_or_create_user(
        db,
        token_data
    )

    return {
        "theme": user.theme,
        "timezone": user.timezone
    }

@router.patch("/preferences/theme")
async def update_theme(
    data: ThemeUpdate,
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user),
):
    user = await get_or_create_user(db, token_data)

    user.theme = data.theme

    await db.commit()
    await db.refresh(user)

    return {"theme": user.theme}

@router.patch("/preferences/timezone")
async def update_timezone(
    data: TimezoneUpdate,
    db: AsyncSession = Depends(get_db),
    token_data=Depends(get_current_user),
):
    user = await get_or_create_user(db, token_data)
    user.timezone = data.timezone
    await db.commit()
    await db.refresh(user)
    return {"timezone": user.timezone}