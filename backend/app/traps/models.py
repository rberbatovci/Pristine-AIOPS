from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, ARRAY, Text, Table
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

class Tag(Base):
    __tablename__ = "trapTags"

    name = Column(String(50), primary_key=True, index=True)
    oids = Column(ARRAY(String), nullable=True) 



class Trap(Base):
    __tablename__ = "traps"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())
    content = Column(JSON, nullable=False, default=dict)
    signal = Column(JSON, nullable=True, default=dict)
    tags = Column(JSON, nullable=True, default=dict)
    device = Column(String(255), nullable=False)
    trapOid = Column(String(255), nullable=True)

class SNMPAuthentication(Base):
    __tablename__ = "snmp_authentications"

    id = Column(Integer, primary_key=True, index=True)
    engineId = Column(String(25), nullable=False)
    user = Column(String(10), nullable=False)
    authProtocol = Column(String(20), nullable=True)
    authPassword = Column(String(25), nullable=False)
    privProtocol = Column(String(20), nullable=True)
    privPassword = Column(String(25), nullable=False)
    secModel = Column(String(15), nullable=True)

trap_rules_association = Table(
    'trap_rules', Base.metadata,
    Column('trap_id', Integer, ForeignKey('snmp_trap_oids.id'), primary_key=True),
    Column('rule_id', Integer, ForeignKey('stateful_trap_rules.id'), primary_key=True) # Corrected ForeignKey
)


class TrapOid(Base):
    __tablename__ = "snmp_trap_oids"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    value = Column(String(255), nullable=False)
    tags = Column(ARRAY(String), nullable=True)
    rules = relationship(
        'StatefulTrapRule',
        secondary=trap_rules_association,
        back_populates='traps'
    )

    @property
    def all_rules(self):
        return list(set(getattr(self, 'open_rules', []) + getattr(self, 'close_rules', [])))

    def __str__(self):
        return self.name

class StatefulTrapRule(Base):
    __tablename__ = "stateful_trap_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    opensignaltrap_id = Column(Integer, ForeignKey('snmp_trap_oids.id'))
    closesignaltrap_id = Column(Integer, ForeignKey('snmp_trap_oids.id'))
    opensignaltrap = relationship('TrapOid', foreign_keys=[opensignaltrap_id], backref='open_rules')
    closesignaltrap = relationship('TrapOid', foreign_keys=[closesignaltrap_id], backref='close_rules')
    opensignaltag = Column(String(255), nullable=False)
    opensignalvalue = Column(String(255), nullable=False)
    closesignaltag = Column(String(255), nullable=False)
    closesignalvalue = Column(String(255), nullable=False)
    initialseverity = Column(String(255), nullable=False)
    affectedentity = Column(JSON, nullable=True, default=list)
    description = Column(Text, nullable=False)
    warmup = Column(Integer, nullable=False)
    cooldown = Column(Integer, nullable=False)

    devices = relationship(
        "Device",
        secondary='stateful_trap_rule_devices',
        back_populates="statefulTrapRules"
    )
    traps = relationship(
        'TrapOid',
        secondary=trap_rules_association,
        back_populates='rules'
    )