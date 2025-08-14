from app.syslogs.mnemonics import Mnemonic
from app.syslogs.rules import StatefulSyslogRule
from app.devices.models import Device
from app.syslogs.regex import RegEx
from app.syslogs.tags import SyslogTag
from app.syslogs.services import mnemonic_rules_association
from app.syslogs.signals import SyslogSignal

from sqlalchemy.orm import configure_mappers
configure_mappers()