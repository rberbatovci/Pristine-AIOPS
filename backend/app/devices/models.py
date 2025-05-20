from sqlalchemy import Column, Integer, DateTime, String, Boolean, Float, ForeignKey, func, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.db.associatedTables import stateful_syslog_rule_devices

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    hostname = Column(String, nullable=False, unique=True)
    ip_address = Column(String, unique=True, nullable=False)
    status = Column(Boolean, nullable=True)
    vendor = Column(String, nullable=True)
    type = Column(String, nullable=True)
    version = Column(String, nullable=True)
    gps_latitude = Column(Float, nullable=True)
    gps_longitude = Column(Float, nullable=True)

    statefulSyslogRules = relationship(
        "StatefulSyslogRule",
        secondary=stateful_syslog_rule_devices,
        back_populates="devices"
    )

    statefulTrapRules = relationship(
        "StatefulTrapRule",
        secondary="stateful_trap_rule_devices",
        back_populates="devices"
    )

class DeviceSyslogStats(Base):
    __tablename__ = "device_syslog_stats"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.hostname"), nullable=False)
    total_syslogs = Column(Integer, default=0)
    last_received = Column(DateTime, nullable=True)
    mnemonics_count = Column(JSON, default=dict)  # e.g., {"LINK_DOWN": 5, "CPU_HIGH": 2}
    syslog_signals = Column(JSON, default=list)  # New field to store syslog events
    
    device = relationship("Device", backref="syslog_stats")

class DeviceTrapStats(Base):
    __tablename__ = "device_trap_stats"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.hostname"), nullable=False)
    total_traps = Column(Integer, default=0)
    last_received = Column(DateTime, nullable=True)
    trap_oids_count = Column(JSON, default=dict)  # e.g., {"1.3.6.1.2.1.1.3.0": 4}
    trap_signals = Column(JSON, default=list)  # New field to store trap events
    
    device = relationship("Device", backref="trap_stats")

class DeviceSignalStats(Base):
    __tablename__ = "device_signal_stats"

    id = Column(Integer, primary_key=True)
    device_id = Column(Integer, ForeignKey("devices.hostname"), nullable=False)
    
    active_syslog_signals = Column(Integer, default=0)
    total_syslog_signals = Column(Integer, default=0)
    syslog_signals = Column(JSON, default=list)  # New field to store syslog signal events

    active_trap_signals = Column(Integer, default=0)
    total_trap_signals = Column(Integer, default=0)
    trap_signals = Column(JSON, default=list)  # New field to store trap signal events

    last_signal_time = Column(DateTime, nullable=True)

    device = relationship("Device", backref="signal_stats")