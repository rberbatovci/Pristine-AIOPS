from app.traps.rules import StatefulTrapRule
from app.devices.models import Device
from app.traps.snmptrapoids import TrapOid
from app.traps.tags import OIDTag
from app.traps.services import trap_oid_tags, trap_rules_association, trap_signal_events

from sqlalchemy.orm import configure_mappers
configure_mappers()