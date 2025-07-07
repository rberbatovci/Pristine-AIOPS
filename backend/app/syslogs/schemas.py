from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Union
from enum import Enum
from .models import MnemonicActions

class SyslogHit(BaseModel):
    _id: str
    _source: dict  # Adjust the type based on the data you're expecting

class OpenSyslog(BaseModel):
    hits: List[SyslogHit]

class SyslogBase(BaseModel):
    message: str
    device: str

class SyslogCreate(BaseModel):
    device: str
    message: str

    class Config:
        from_attributes = True

class Syslog(SyslogBase):
    id: int
    lsn: int
    tags: Optional[Dict[str, Any]] = None
    signal: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    mnemonic: str

    class Config:
        from_attributes = True

class MatchOptions(str, Enum):
    search = 'search'
    findall = 'findall'
    finditer = 'finditer'
    undefined = 'undefined'

class RegExCreate(BaseModel):
    name: str
    pattern: str | None = None
    matchfunction: MatchOptions = MatchOptions.undefined
    matchnumber: int | None = None
    groupnumber: int | None = None
    nomatch: Optional[str]
    tag: str | None = None

class RegExUpdate(BaseModel):
    name: str | None = None
    pattern: str | None = None
    matchfunction: MatchOptions | None = None
    matchnumber: int | None = None
    groupnumber: int | None = None
    nomatch: str | None = None
    tag: str | None = None

class RegExResponse(BaseModel):
    id: int
    name: str
    pattern: Optional[str]
    matchfunction: MatchOptions
    matchnumber: Optional[int]
    groupnumber: Optional[int]
    nomatch: str
    tag: Optional[str]

    class Config:
        from_attributes = True

class RegExSchema(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
        
class TagBase(BaseModel):
    name: str

    class Config:
        from_attributes = True

class TagCreate(TagBase):
    pass

class TagSchema(TagBase):
    pass
    
class RegExBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class DeviceConfigChoices(str, Enum):
    ipAddress = 'ipAddress'
    inSyslog = 'inSyslog'


class TimestampConfigChoices(str, Enum):
    autoNow = 'autoNow'
    inSyslog = 'inSyslog'

class MnemonicsBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
        
class MnemonicCreate(BaseModel):
    name: str
    level: int # Changed type here
    severity: Optional[str] = None
    rules: Optional[List[str]] = None
    regexes: Optional[List[str]] = None

class RuleInfo(BaseModel):
    name: str

    class Config:
        from_attributes = True


class MnemonicSyslog(BaseModel):
    id: int
    name: str
    severity: Optional[str] = None
    regexes: Optional[List[str]] = None
    rules: Optional[List[RuleInfo]] = None

    class Config:
        from_attributes = True

# ===== ReceiverAgentConfig Schemas =====
class ReceiverAgentConfigBase(BaseModel):
    device: DeviceConfigChoices = DeviceConfigChoices.ipAddress
    regExPattern: Optional[str] = None
    regExFunction: Optional[str] = None
    regExGrNr: Optional[int] = None

class ReceiverAgentConfigCreate(ReceiverAgentConfigBase):
    pass

class ReceiverAgentConfigUpdate(ReceiverAgentConfigBase):
    pass

class ReceiverAgentConfigOut(ReceiverAgentConfigBase):
    id: int

    class Config:
        from_attributes = True


# ===== ReceiverTimestampConfig Schemas =====
class ReceiverTimestampConfigBase(BaseModel):
    timestamp: TimestampConfigChoices = TimestampConfigChoices.inSyslog
    regExPattern: Optional[str] = None
    regExFunction: Optional[str] = None
    regExGrNr: Optional[int] = None

class ReceiverTimestampConfigCreate(ReceiverTimestampConfigBase):
    pass

class ReceiverTimestampConfigUpdate(ReceiverTimestampConfigBase):
    pass

class ReceiverTimestampConfigOut(ReceiverTimestampConfigBase):
    id: int

    class Config:
        from_attributes = True

class StatefulSyslogRuleBase(BaseModel):
    name: str
    opensignalmnemonic: Optional[str] = None
    closesignalmnemonic: Optional[str] = None
    opensignaltag: str
    opensignalvalue: str
    closesignaltag: str
    closesignalvalue: str
    initialseverity: str
    affectedentity: Optional[List[Any]] = None
    description: str
    warmup: int
    cooldown: int
    device_hostnames: Optional[List[str]] = None

class StatefulSyslogRule(StatefulSyslogRuleBase):
    id: int

    class Config:
        from_attributes = True

class StatefulSyslogRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class MnemonicWithRules(MnemonicSyslog):
    id: int
    regexes: List[str] = []
    rules: List[str] = []  # New field for rule names

    class Config:
        from_attributes = True