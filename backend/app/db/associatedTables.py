from sqlalchemy import Table, Column, Integer, ForeignKey, String
from app.db.session import Base

stateful_syslog_rule_devices = Table(
    "stateful_syslog_rule_devices",
    Base.metadata,
    Column("device_id", Integer, ForeignKey("devices.id"), primary_key=True),
    Column("stateful_syslog_rule_id", Integer, ForeignKey("stateful_syslog_rules.id"), primary_key=True),
)

stateful_trap_rule_devices = Table(
    "stateful_trap_rule_devices",
    Base.metadata,
    Column("device_id", Integer, ForeignKey("devices.id"), primary_key=True),
    Column("stateful_trap_rule_id", Integer, ForeignKey("stateful_trap_rules.id"), primary_key=True),
)

mnemonic_regex = Table(
    'mnemonic_regex', Base.metadata,
    Column('mnemonic_id', Integer, ForeignKey('mnemonics.id'), primary_key=True),
    Column('regex_id', Integer, ForeignKey('regex.id'), primary_key=True)
)