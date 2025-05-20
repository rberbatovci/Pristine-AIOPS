# schemas.py
from pydantic import BaseModel
from datetime import datetime
from typing import List

# Base schemas (shared properties)
class IPFIXHeaderBase(BaseModel):
    version: int
    length: int
    export_time: int
    sequence_number: int
    observation_id: int

class FlowRecordBase(BaseModel):
    source_addr: str
    dest_addr: str
    protocol: int
    source_port: int
    dest_port: int
    input_snmp: int
    output_snmp: int
    bytes_count: int
    packets_count: int
    first_timestamp: int
    last_timestamp: int

# Response schemas (what's returned from API)
class FlowRecord(FlowRecordBase):
    id: int
    header_id: int
    created_at: datetime

    class Config:
        from_attributes = True
        
class IPFIXHeader(IPFIXHeaderBase):
    id: int
    created_at: datetime
    records: List["FlowRecord"] = []  # Forward reference

    class Config:
        from_attributes = True

# Combined schema for receiving complete packets
class NetFlowPacket(BaseModel):
    header: "IPFIXHeaderCreate"
    records: List["FlowRecordCreate"]

# Create schemas (for POST requests)
class FlowRecordCreate(FlowRecordBase):
    pass

class IPFIXHeaderCreate(IPFIXHeaderBase):
    records: List[FlowRecordCreate] = []

# Update NetFlowData to use Pydantic schemas
class NetFlowData(BaseModel):
    header: IPFIXHeaderCreate
    records: List[FlowRecordCreate]