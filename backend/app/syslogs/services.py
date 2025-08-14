
from app.db.session import Base
from sqlalchemy import Column, Integer, ForeignKey, Table

mnemonic_rules_association = Table(
    'mnemonic_rules', Base.metadata,
    Column('mnemonic_id', Integer, ForeignKey('mnemonics.id')),
    Column('rule_id', Integer, ForeignKey('stateful_syslog_rules.id'))
)

syslog_signal_events = Table(
    "syslog_signal_events", Base.metadata,
    Column("syslog_signal_id", Integer, ForeignKey("syslog_signal.id")),
    Column("syslog_id", Integer, ForeignKey("syslogs.id"))
)