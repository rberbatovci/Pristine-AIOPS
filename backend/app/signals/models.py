from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSON
from app.db.session import Base

# Association tables for Many-to-Many relationships
syslog_signal_mnemonics = Table(
    "syslog_signal_mnemonics", Base.metadata,
    Column("syslog_signal_id", Integer, ForeignKey("syslog_signal.id")),
    Column("mnemonic_id", Integer, ForeignKey("mnemonics.id"))
)

syslog_signal_events = Table(
    "syslog_signal_events", Base.metadata,
    Column("syslog_signal_id", Integer, ForeignKey("syslog_signal.id")),
    Column("syslog_id", Integer, ForeignKey("syslogs.id"))
)

trap_signal_events = Table(
    "trap_signal_events", Base.metadata,
    Column("trap_signal_id", Integer, ForeignKey("trap_signal.id")),
    Column("snmptrap_id", Integer, ForeignKey("snmptraps.id"))
)

trap_signal_oids = Table(
    "trap_signal_oids", Base.metadata,
    Column("trap_signal_id", Integer, ForeignKey("trap_signal.id")),
    Column("oid_id", Integer, ForeignKey("snmptrap_oids.id"))
)


class SyslogSignal(Base):
    __tablename__ = "syslog_signal"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(10), nullable=False)
    startTime = Column(DateTime, nullable=False)
    endTime = Column(DateTime, nullable=True)
    hostname = Column(String, ForeignKey("device.hostname"), nullable=False)
    source = Column(String(15), nullable=True)
    affectedEntity = Column(JSON, nullable=True)
    description = Column(Text, default='')
    rule_name = Column(String(255), ForeignKey("stateful_syslog_rules.name"), nullable=False)
    mnemonics_name = Column(String(255), ForeignKey("mnemonics.name"), nullable=False)
    events = relationship("Syslog", secondary="syslog_signal_events", back_populates="signals")

class TrapSignal(Base):
    __tablename__ = "trap_signal"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(10), nullable=False)
    startTime = Column(DateTime, nullable=False)
    endTime = Column(DateTime, nullable=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)
    source = Column(String(15), nullable=True)
    rule_id = Column(Integer, ForeignKey("stateful_trap_rules.id"), nullable=True)
    affectedEntity = Column(JSON, nullable=True)
    description = Column(Text, default='')


class SyslogSignalSeverity(Base):
    __tablename__ = "syslogsignalseverity"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(Integer, nullable=False)
    severity = Column(String(15), nullable=False)
    description = Column(String(255), nullable=False)