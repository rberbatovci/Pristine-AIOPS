from pydantic import BaseModel
from typing import Literal


# -------------------------
# Base response model
# -------------------------
class UserPreferencesResponse(BaseModel):
    theme: Literal["light", "dark"]
    timezone: str

    class Config:
        from_attributes = True


# -------------------------
# Update theme only
# -------------------------
class ThemeUpdate(BaseModel):
    theme: Literal["light", "dark"]


# -------------------------
# Update timezone only
# -------------------------
class TimezoneUpdate(BaseModel):
    timezone: str