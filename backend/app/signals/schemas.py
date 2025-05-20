from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class SyslogSignalSeverityBase(BaseModel):
    number: int
    severity: str
    description: str

    class Config:
        from_attributes = True 


class SyslogSignalBase(BaseModel):
    state: str
    startTime: datetime
    endTime: Optional[datetime] = None
    source: Optional[str] = None
    rule_id: Optional[int] = None
    device_id: Optional[int] = None
    affectedEntity: Optional[dict] = None
    description: Optional[str] = ''


class SyslogSignalCreate(SyslogSignalBase):
    pass


class SyslogSignalRead(SyslogSignalBase):
    id: int

    class Config:
        from_attributes = True


class TrapSignalBase(BaseModel):
    state: str
    startTime: datetime
    endTime: Optional[datetime] = None
    source: Optional[str] = None
    rule_id: Optional[int] = None
    device_id: Optional[int] = None
    affectedEntity: Optional[dict] = None
    description: Optional[str] = ''


class TrapSignalCreate(TrapSignalBase):
    pass


class TrapSignalRead(TrapSignalBase):
    id: int

    class Config:
        from_attributes = True
