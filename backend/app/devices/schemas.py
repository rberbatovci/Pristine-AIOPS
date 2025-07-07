from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class TelemetryFeatures(BaseModel):
    cpu_util: Optional[bool] = False
    memory_stats: Optional[bool] = False
    interface_stats: Optional[bool] = False
    bgp_connections: Optional[bool] = False
    isis_stats: Optional[bool] = False

class DeviceFeatures(BaseModel):
    syslogs: Optional[bool] = False
    snmp_traps: Optional[bool] = False
    netflow: Optional[bool] = False
    telemetry: Optional[TelemetryFeatures] = None

class DeviceBase(BaseModel):
    hostname: str
    ip_address: str
    status: Optional[bool] = None
    vendor: Optional[str] = None 
    type: Optional[str] = None
    version: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    features: Optional[DeviceFeatures] = None

class DeviceUpdatePartial(BaseModel):
    status: Optional[bool] = None
    vendor: Optional[str] = None
    type: Optional[str] = None
    version: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None

class DeviceCreate(DeviceBase):
    hostname: str
    ip_address: str


class DeviceUpdate(DeviceBase):
    pass


class DeviceInDBBase(DeviceBase):
    id: int

    class Config:
        from_attributes = True


class DeviceResponse(DeviceInDBBase):
    pass

class SyslogConfig(BaseModel):
    severity: Optional[str] = "informational"

class NetflowConfig(BaseModel):
    enabled: bool
    interfaces: List[str]

class CPUTelemetryConfig(BaseModel):
    receiver_ip: str
    receiver_port: int