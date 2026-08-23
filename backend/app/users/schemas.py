from pydantic import BaseModel, field_validator
from typing import Literal
import zoneinfo

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

    @field_validator("timezone")
    def validate_iana_timezone(cls, value: str) -> str:
        if value not in zoneinfo.available_timezones():
            raise ValueError(f"'{value}' is not a valid IANA time zone.")
        return value