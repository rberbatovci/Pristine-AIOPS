from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Boolean, Enum, Text, Table
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime, timezone
from enum import Enum as PyEnum
from sqlalchemy.sql import func
from app.db.session import Base
from app.devices.models import Device
from app.db.associatedTables import stateful_syslog_rule_devices

class Syslog(Base):
    __tablename__ = "syslogs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=True)
    lsn = Column(Integer, nullable=True)
    device = Column(String, ForeignKey("devices.hostname"), nullable=False)
    message = Column(String, nullable=False)
    received_at = Column(DateTime, nullable=False, server_default=func.now())
    tags = Column(JSON, nullable=True, default=dict)
    signal = Column(JSON, nullable=True, default=dict)
    mnemonic = Column(String(50), nullable=True)
    # Relationship to SyslogSignal via events (many-to-many relationship)
    signals = relationship("SyslogSignal", secondary="syslog_signal_events", back_populates="events")

class MatchOptions(PyEnum):
    search = 'search'
    findall = 'findall'
    finditer = 'finditer'
    undefined = 'undefined'

class SyslogTag(Base):
    __tablename__ = 'syslogTags'

    name = Column(String(50), primary_key=True, index=True)

    def __str__(self):
        return self.name

class RegEx(Base):
    __tablename__ = 'regex'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(25), unique=True, index=True)
    pattern = Column(String(255), nullable=True, default=None)
    matchfunction = Column(String(25), nullable=False, default='search')
    matchnumber = Column(Integer, nullable=True, default=None)
    groupnumber = Column(Integer, nullable=True, default=None)
    nomatch = Column(String(25), nullable=True, default="")
    tag = Column(String(50), ForeignKey('syslogTags.name'), nullable=True)

    def __str__(self):
        return self.name
    
class MnemonicActions(PyEnum):
    muteSignal = 'muteSignal'
    createSignal = 'createSignal'
    noAction = 'noAction'

mnemonic_rules_association = Table(
    'mnemonic_rules', Base.metadata,
    Column('mnemonic_id', Integer, ForeignKey('mnemonics.id')),
    Column('rule_id', Integer, ForeignKey('stateful_syslog_rules.id'))
)

class Mnemonic(Base):
    __tablename__ = 'mnemonics'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(30), unique=True, index=True)
    level = Column(Integer, nullable=True, default=None)
    severity = Column(String(15), nullable=True, default=None)
    regexes = relationship('RegEx', secondary='mnemonic_regex', backref='mnemonics')
    rules = relationship(
        'StatefulSyslogRule',
        secondary=mnemonic_rules_association,
        back_populates='mnemonics'
    )

    @property
    def all_rules(self):
        return list(set(self.open_rules + self.close_rules))

    def __str__(self):
        return self.name

class deviceConfigChoices(PyEnum):
    ipAddress = 'ipAddress'
    inSyslog = 'inSyslog'

class timestampConfigChoices(PyEnum):
    autoNow = 'autoNow'
    inSyslog = 'inSyslog'

class ReceiverAgentConfig(Base):
    __tablename__ = 'receiverAgentConfig'

    id = Column(Integer, primary_key=True, index=True) # Added primary key
    device = Column(Enum(deviceConfigChoices), default=deviceConfigChoices.ipAddress)
    regExPattern = Column(String(30), nullable=True, default=None)
    regExFunction = Column(String(10), nullable=True, default=None)
    regExGrNr = Column(Integer, nullable=True, default=None)

class ReceiverTimestampConfig(Base):
    __tablename__ = 'receiverTimestampConfig'

    id = Column(Integer, primary_key=True, index=True) # Added primary key
    timestamp = Column(Enum(timestampConfigChoices), default=timestampConfigChoices.inSyslog)
    regExPattern = Column(String(30), nullable=True, default=None)
    regExFunction = Column(String(10), nullable=True, default=None)
    regExGrNr = Column(Integer, nullable=True, default=None)


class StatefulSyslogRule(Base):
    __tablename__ = "stateful_syslog_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    opensignalmnemonic_id = Column(Integer, ForeignKey('mnemonics.id'))
    closesignalmnemonic_id = Column(Integer, ForeignKey('mnemonics.id'))
    opensignalmnemonic = relationship('Mnemonic', foreign_keys=[opensignalmnemonic_id], backref='open_rules')
    closesignalmnemonic = relationship('Mnemonic', foreign_keys=[closesignalmnemonic_id], backref='close_rules')
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
        secondary='stateful_syslog_rule_devices',
        back_populates="statefulSyslogRules"
    )
    mnemonics = relationship(
        'Mnemonic',
        secondary=mnemonic_rules_association,
        back_populates='rules'
    )