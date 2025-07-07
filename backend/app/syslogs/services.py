from .schemas import Syslog, SyslogCreate
from .models import Syslog as SyslogModel
from .models import RegEx as RegExModel
from .models import StatefulSyslogRule
from .models import Mnemonic as MnemonicModel
from .models import ReceiverTimestampConfig, ReceiverAgentConfig
from app.signals.models import SyslogSignalSeverity
import json
import os
from .schemas import ReceiverAgentConfigUpdate, ReceiverTimestampConfigUpdate
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.devices.models import Device
from datetime import datetime, timezone
from pathlib import Path

SHARED_DATA_DIR = "/app/syslogs/rules"
REGEX_JSON_PATH = os.path.join(SHARED_DATA_DIR, "regex_data.json")
MNEMONICS_JSON_PATH = os.path.join(SHARED_DATA_DIR, "mnemonics.json")

def create_mnemonic_in_file(name: str, level: int, severity: int):
    if not Path(MNEMONICS_JSON_PATH).exists():
        raise FileNotFoundError(f"{MNEMONICS_JSON_PATH} does not exist")

    with open(MNEMONICS_JSON_PATH, "r") as f:
        data = json.load(f)

    # Avoid duplicate entries by name
    if any(m.get("name") == name for m in data.get("mnemonics", [])):
        raise ValueError(f"Mnemonic '{name}' already exists in file")

    new_mnemonic = {
        "name": name,
        "level": level,
        "severity": severity,
        "regexes": [],
        "rules": []
    }

    data.setdefault("mnemonics", []).append(new_mnemonic)

    with open(MNEMONICS_JSON_PATH, "w") as f:
        json.dump(data, f, indent=4)

async def updateSeveritySettings(db: AsyncSession):
    try:
        # Load existing JSON
        with open(MNEMONICS_JSON_PATH, "r") as f:
            data = json.load(f)

        # Fetch new severity config
        result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
        severity_settings = result.scalars().first()

        if not severity_settings:
            raise Exception("SyslogSignalSeverity settings not found")

        # Update only severity part
        data["severity"] = {
            "minimum": severity_settings.number,
            "description": severity_settings.description
        }

        # Save back to file
        with open(MNEMONICS_JSON_PATH, "w") as f:
            json.dump(data, f, indent=4)

        print("Severity updated in mnemonics.json")

    except Exception as e:
        print(f"Error updating severity in mnemonics.json: {e}")

async def save_statefulrules_to_file(db: AsyncSession):
    try:
        result = await db.execute(
            select(StatefulSyslogRule)
            .options(
                selectinload(StatefulSyslogRule.opensignalmnemonic),
                selectinload(StatefulSyslogRule.closesignalmnemonic),
                selectinload(StatefulSyslogRule.devices),
            )
        )
        rules = result.scalars().all()

        rule_list = []
        for rule in rules:
            rule_list.append({
                "id": rule.id,
                "name": rule.name,
                "opensignalmnemonic": rule.opensignalmnemonic.name if rule.opensignalmnemonic else None,
                "closesignalmnemonic": rule.closesignalmnemonic.name if rule.closesignalmnemonic else None,
                "opensignaltag": rule.opensignaltag,
                "opensignalvalue": rule.opensignalvalue,
                "closesignaltag": rule.closesignaltag,
                "closesignalvalue": rule.closesignalvalue,
                "initialseverity": rule.initialseverity,
                "affectedentity": rule.affectedentity,
                "description": rule.description,
                "warmup": rule.warmup,
                "cooldown": rule.cooldown,
                "device_hostnames": [device.hostname for device in rule.devices],
            })

        STATEFUL_RULES_JSON_PATH = "/app/signals/rules/statefulSyslogRules.json"
        os.makedirs(os.path.dirname(STATEFUL_RULES_JSON_PATH), exist_ok=True)

        with open(STATEFUL_RULES_JSON_PATH, "w") as f:
            json.dump(rule_list, f, indent=4)

        print(f"Stateful rules saved to: {STATEFUL_RULES_JSON_PATH}")

    except Exception as e:
        print(f"Error writing statefulrules.json: {e}")

async def remove_rule_from_json(rule_name: str):
    STATEFUL_RULES_JSON_PATH = "/app/signals/rules/statefulSyslogRules.json"
    print(f">>> Attempting to remove rule '{rule_name}' from JSON")

    try:
        if not os.path.exists(STATEFUL_RULES_JSON_PATH):
            print(f">>> File does not exist: {STATEFUL_RULES_JSON_PATH}")
            return

        with open(STATEFUL_RULES_JSON_PATH, "r") as f:
            rules = json.load(f)

        print(f">>> Loaded {len(rules)} rule(s) from JSON")

        # Filter out the rule with the matching name
        updated_rules = [rule for rule in rules if rule["name"] != rule_name]

        if len(updated_rules) == len(rules):
            print(f">>> No rule named '{rule_name}' found in JSON.")
        else:
            with open(STATEFUL_RULES_JSON_PATH, "w") as f:
                json.dump(updated_rules, f, indent=4)
            print(f">>> Rule '{rule_name}' removed and JSON updated")

    except Exception as e:
        print(f">>> Error removing rule from {STATEFUL_RULES_JSON_PATH}")
        traceback.print_exc()

async def update_mnemonics_list_in_json(db: AsyncSession):

    MnemonicPath = Path(MNEMONICS_JSON_PATH)

    if not MnemonicPath.exists():
        raise FileNotFoundError(f"{MnemonicPath} not found.")

    with MnemonicPath.open("r") as f:
        data = json.load(f)

    if "mnemonics" not in data:
        raise ValueError("Invalid mnemonics.json format.")

    # Load all mnemonics and rules
    result_mnemonics = await db.execute(
        select(MnemonicModel).options(
            selectinload(MnemonicModel.regexes)
        )
    )
    db_mnemonics = result_mnemonics.scalars().all()

    result_rules = await db.execute(
        select(StatefulSyslogRule)
        .options(
            selectinload(StatefulSyslogRule.opensignalmnemonic),
            selectinload(StatefulSyslogRule.closesignalmnemonic)
        )
    )
    db_rules = result_rules.scalars().all()

    # Build a lookup from mnemonic name to list of rule names
    mnemonic_to_rules = {}

    for rule in db_rules:
        seen = set()
        for mnemonic in [rule.opensignalmnemonic, rule.closesignalmnemonic]:
            if mnemonic and mnemonic.name not in seen:
                seen.add(mnemonic.name)
                if mnemonic.name not in mnemonic_to_rules:
                    mnemonic_to_rules[mnemonic.name] = set()
                mnemonic_to_rules[mnemonic.name].add(rule.name)

    # Create a map from name -> JSON mnemonic object
    json_mnemonic_map = {m["name"]: m for m in data["mnemonics"]}

    for db_mnemonic in db_mnemonics:
        if db_mnemonic.name not in json_mnemonic_map:
            continue

        json_mnemonic = json_mnemonic_map[db_mnemonic.name]
        json_mnemonic["regexes"] = [r.name for r in db_mnemonic.regexes]
        json_mnemonic["level"] = db_mnemonic.level
        json_mnemonic["severity"] = db_mnemonic.severity

        json_mnemonic["rules"] = list(mnemonic_to_rules.get(db_mnemonic.name, []))

    with MnemonicPath.open("w") as f:
        json.dump(data, f, indent=4)

async def save_rules_to_mnemonic(db: AsyncSession):

    MnemonicPath = Path(MNEMONICS_JSON_PATH)

    if not MnemonicPath.exists():
        raise FileNotFoundError(f"{MnemonicPath} not found.")

    with MnemonicPath.open("r") as f:
        data = json.load(f)

    if "mnemonics" not in data:
        raise ValueError("Invalid mnemonics.json format.")

    # Get all stateful rules from DB
    result = await db.execute(
        select(StatefulSyslogRule)
        .options(
            selectinload(StatefulSyslogRule.opensignalmnemonic),
            selectinload(StatefulSyslogRule.closesignalmnemonic)
        )
    )
    rules = result.scalars().all()

    # Build a map for quick lookup
    mnemonic_map = {m["name"]: m for m in data["mnemonics"]}

    # Reset rules in JSON first
    for m in data["mnemonics"]:
        m["rules"] = []

    # Re-populate rules per mnemonic from DB state
    for rule in rules:
        if rule.opensignalmnemonic and rule.opensignalmnemonic.name in mnemonic_map:
            rules_list = mnemonic_map[rule.opensignalmnemonic.name]["rules"]
            if rule.name not in rules_list:
                rules_list.append(rule.name)

        if rule.closesignalmnemonic and rule.closesignalmnemonic.name in mnemonic_map:
            rules_list = mnemonic_map[rule.closesignalmnemonic.name]["rules"]
            if rule.name not in rules_list:
                rules_list.append(rule.name)

    with MnemonicPath.open("w") as f:
        json.dump(data, f, indent=4)

async def remove_rule_from_mnemonics_json(rule_name: str, open_mnemonic_name: str, close_mnemonic_name: str):
    MnemonicPath = Path(MNEMONICS_JSON_PATH)

    if not MnemonicPath.exists():
        raise FileNotFoundError(f"{MnemonicPath} not found.")

    with MnemonicPath.open("r") as f:
        data = json.load(f)

    if "mnemonics" not in data:
        raise ValueError("Invalid mnemonics.json format.")

    updated = False
    for mnemonic in data["mnemonics"]:
        if mnemonic["name"] in {open_mnemonic_name, close_mnemonic_name}:
            if "rules" in mnemonic and rule_name in mnemonic["rules"]:
                mnemonic["rules"].remove(rule_name)
                updated = True

    if updated:
        with MnemonicPath.open("w") as f:
            json.dump(data, f, indent=4)

async def create_syslog(db: AsyncSession, syslog: SyslogCreate):
    # Get device by IP address
    result = await db.execute(select(Device).where(Device.ip_address == syslog.device_ip))
    device = result.scalars().first()

    if not device:
        raise ValueError("Device with the given IP address not found")

    # Convert timezone-aware datetime to timezone-naive
    received_at = datetime.now(timezone.utc).replace(tzinfo=None)

    # Create Syslog entry
    db_syslog = SyslogModel(
        message=syslog.message,
        received_at=received_at,
        device_id=device.id
    )

    db.add(db_syslog)
    await db.commit()
    await db.refresh(db_syslog)
    return db_syslog

async def get_syslogs(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(select(SyslogModel).offset(skip).limit(limit))
    return result.scalars().all()

from sqlalchemy.orm import Session
from .schemas import RegExCreate, RegExUpdate

async def get_regexes(db: AsyncSession, skip: int = 0, limit: int = 100):
    stmt = select(RegExModel).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_mnemonic_by_name(db: AsyncSession, name: str):
    stmt = select(MnemonicModel).filter(MnemonicModel.name == name)
    result = await db.execute(stmt)
    return result.scalars().first()

async def get_regex_by_name(db: AsyncSession, name: str):
    stmt = select(RegExModel).filter(RegExModel.name == name)
    result = await db.execute(stmt)
    return result.scalars().first()

async def create_regex(db: AsyncSession, regex: RegExCreate):
    db_regex = RegExModel(**regex.dict())
    db.add(db_regex)
    await db.commit()
    await db.refresh(db_regex)
    return db_regex

async def update_regex(db: AsyncSession, regex_name: str, regex_update: RegExUpdate):
    stmt = select(RegExModel).filter(RegExModel.name == regex_name)
    result = await db.execute(stmt)
    db_regex = result.scalars().first()

    if db_regex:
        for key, value in regex_update.dict(exclude_unset=True).items():
            setattr(db_regex, key, value)
        await db.commit()
        await db.refresh(db_regex)
    return db_regex

async def delete_regex(db: AsyncSession, regex_name: str):
    stmt = select(RegExModel).filter(RegExModel.name == regex_name)
    result = await db.execute(stmt)
    db_regex = result.scalars().first()

    if db_regex:
        await db.delete(db_regex)
        await db.commit()
        return True
    return False

async def get_regex_brief(db: AsyncSession):
    stmt = select(RegExModel.id, RegExModel.name)
    result = await db.execute(stmt)
    return result.all()

# === AGENT CONFIG ===
async def getAgentConfigService(db: AsyncSession):
    result = await db.execute(select(ReceiverAgentConfig))
    return result.scalar_one_or_none()

async def updateAgentConfigService(db: AsyncSession, data: ReceiverAgentConfigUpdate):
    result = await db.execute(select(ReceiverAgentConfig))
    config = result.scalar_one_or_none()
    if not config:
        config = ReceiverAgentConfig(**data.dict())
        db.add(config)
    else:
        for key, value in data.dict().items():
            setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    return config

# === TIMESTAMP CONFIG ===
async def getTimestampConfigService(db: AsyncSession):
    result = await db.execute(select(ReceiverTimestampConfig))
    return result.scalar_one_or_none()

async def updateTimestampConfigService(db: AsyncSession, data: ReceiverTimestampConfigUpdate):
    result = await db.execute(select(ReceiverTimestampConfig))
    config = result.scalar_one_or_none()
    if not config:
        config = ReceiverTimestampConfig(**data.dict())
        db.add(config)
    else:
        for key, value in data.dict().items():
            setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    return config


