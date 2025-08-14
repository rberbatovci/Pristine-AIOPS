
from app.db.session import Base
from sqlalchemy import Column, Integer, ForeignKey, Table, String

trap_oid_tags = Table(
    'trap_oid_tags',
    Base.metadata,
    Column('trap_oid_id', Integer, ForeignKey('snmp_trap_oids.id', ondelete="CASCADE"), primary_key=True),
    Column('tag_name', String(50), ForeignKey('trapTags.name', ondelete="CASCADE"), primary_key=True),
)

trap_rules_association = Table(
    'trap_rules', Base.metadata,
    Column('trap_id', Integer, ForeignKey('snmp_trap_oids.id'), primary_key=True),
    Column('rule_id', Integer, ForeignKey('stateful_trap_rules.id'), primary_key=True)
)

trap_signal_events = Table(
    "trap_signal_events", Base.metadata,
    Column("trap_signal_id", Integer, ForeignKey("trap_signal.id")),
    Column("snmptrap_id", Integer, ForeignKey("snmptraps.id"))
)