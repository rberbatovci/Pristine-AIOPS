from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.session import get_db
from .models import User
from .schemas import (
    UserPreferencesResponse,
    ThemeUpdate,
    TimezoneUpdate
)
from app.auth.keycloak import get_current_user
 
router = APIRouter(
    prefix="/api/users/me",
    tags=["User Preferences"],
)

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
    user_id: str = Depends(get_current_user)
):
    result = await db.execute(
        select(User).where(User.keycloak_user_id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.theme = data.theme

    await db.commit()
    await db.refresh(user)

    return {"theme": user.theme}

@router.patch("/preferences/timezone")
async def update_timezone(
    data: TimezoneUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user)
):
    result = await db.execute(
        select(User).where(User.keycloak_user_id == user_id)
    )

    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.timezone = data.timezone

    await db.commit()
    await db.refresh(user)

    return {"timezone": user.timezone}