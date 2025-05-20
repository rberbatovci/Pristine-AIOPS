from pydantic import BaseModel
from typing import Optional


class DeviceBase(BaseModel):
    hostname: str
    ip_address: str
    status: Optional[bool] = None
    vendor: Optional[str] = None 
    type: Optional[str] = None
    version: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None


class DeviceCreateMinimal(BaseModel):
    hostname: str
    ip_address: str


class DeviceUpdatePartial(BaseModel):
    status: Optional[bool] = None
    vendor: Optional[str] = None
    type: Optional[str] = None
    version: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(DeviceBase):
    pass


class DeviceInDBBase(DeviceBase):
    id: int

    class Config:
        from_attributes = True


class DeviceResponse(DeviceInDBBase):
    pass