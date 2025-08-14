from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, ARRAY, Text, Table, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from sqlalchemy.sql import func
from app.db.session import Base
from app.db.associatedTables import stateful_trap_rule_devices





class SNMPOID(Base):
    __tablename__ = "snmp_oids"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), index=True)
    oid = Column(String(255), index=True)
    description = Column(String(255), nullable=True)




