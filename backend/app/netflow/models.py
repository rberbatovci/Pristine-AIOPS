# models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.orm import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import INET
from app.db.session import Base

class IPFIXHeader(Base):
    __tablename__ = "ipfix_headers"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, nullable=False)
    length = Column(Integer, nullable=False)
    export_time = Column(BigInteger, nullable=False)
    sequence_number = Column(Integer, nullable=False)
    observation_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default='now()')

    # Relationship to flow records
    records = relationship("FlowRecord", back_populates="header")

class FlowRecord(Base):
    __tablename__ = "flow_records"

    id = Column(Integer, primary_key=True, index=True)
    header_id = Column(Integer, ForeignKey('ipfix_headers.id'), nullable=False)
    source_addr = Column(INET, nullable=False)
    dest_addr = Column(INET, nullable=False)
    protocol = Column(Integer, nullable=False)
    source_port = Column(Integer, nullable=False)
    dest_port = Column(Integer, nullable=False)
    input_snmp = Column(BigInteger, nullable=False)
    output_snmp = Column(BigInteger, nullable=False)
    bytes_count = Column(BigInteger, nullable=False)
    packets_count = Column(BigInteger, nullable=False)
    first_timestamp = Column(BigInteger, nullable=False)
    last_timestamp = Column(BigInteger, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship to header
    header = relationship("IPFIXHeader", back_populates="records")