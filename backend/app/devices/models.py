from sqlalchemy import Column, Integer, DateTime, String, Boolean, Float, ForeignKey, func, JSON
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.db.associatedTables import stateful_syslog_rule_devices
from sqlalchemy.dialects.postgresql import JSONB

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
    features = Column(JSONB) 

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
