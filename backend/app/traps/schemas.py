from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class SNMPConfig(BaseModel):
    udp_port: int
    msg_flags: str
    username: str
    auth_pass: str
    auth_proto: str
    priv_pass: str
    priv_proto: str
    engineid: str

class TagBase(BaseModel):
    name: str
    oids: list[str] | None = None 

    class Config:
        from_attributes = True

class TagSchema(TagBase):
    pass

class TagCreate(TagBase):
    pass 

class TagDelete(BaseModel):
    name: str
    
class SNMPOIDSchema(BaseModel):
    id: int
    name: str
    oid: str
    tag_id: Optional[int]
    description: Optional[str]

class TrapOid(BaseModel):
    id: Optional[int] = None
    name: Optional[str]
    value: Optional[str] = None
    tags: Optional[List[str]] = []
    rules: Optional[List[str]] = []

class TrapOidBrief(BaseModel):
    id: int
    name: str

class TrapCreate(BaseModel):
    content: Dict[str, Any]
    device: str
    
    class Config:
        from_attributes = True

class TrapOidUpdate(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None

class TrapBase(BaseModel):
    content: dict
    device: str

class Trap(TrapBase):
    id: int
    tags: Optional[Dict[str, Any]] = None
    signal: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None
    device: str
    trapOid: Optional[str]

    class Config:
        from_attributes = True
    
class SNMPAuthenticationSchema(BaseModel):
    id: int
    engineId: str
    user: str
    authProtocol: Optional[str]
    authPassword: str
    privProtocol: Optional[str]
    privPassword: str
    secModel: Optional[str]

class StatefulTrapRulesSchema(BaseModel):
    id: int
    name: str
    devices: Optional[List[int]]
    devicesFilter: Optional[str]
    open_signal_trap_id: int
    close_signal_trap_id: int
    open_signal_event_id: Optional[int]
    close_signal_event_id: Optional[int]
    affected_entity: Optional[List[int]]
    initialSeverity: Optional[str]
    description: Optional[str]
    warmUp: int
    coolDown: int

class StatefulTrapRuleBase(BaseModel):
    name: str
    opensignaltrap: Optional[str] = None
    closesignaltrap: Optional[str] = None
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

class StatefulTrapRule(StatefulTrapRuleBase):
    id: Optional[int]

    class Config:
        from_attributes = True

class StatefulTrapRuleBrief(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class StatefulTrapRuleResponse(StatefulTrapRuleBase):
    id: int
    opensignaltrap: Optional[str]
    closesignaltrap: Optional[str]
    device_hostnames: Optional[List[str]] = None

    class Config:
        from_attributes = True