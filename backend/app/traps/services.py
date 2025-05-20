from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import Trap as TrapModel, StatefulTrapRule
from .models import TrapOid, SNMPOID
from .schemas import TrapCreate
from app.devices.models import Device
from datetime import datetime, timezone
from pathlib import Path
import json
import os
from sqlalchemy.orm import selectinload

SnmpTrapOidFile = Path("/app/traps/snmpTrapOids.json")

async def createTrap(db: AsyncSession, trap: TrapCreate):
    # Get device by IP address
    result = await db.execute(select(Device).where(Device.ip_address == trap.device_ip))
    device = result.scalars().first()

    if not device:
        raise ValueError("Device with the given IP address not found")

    # Create Syslog entry
    db_syslog = TrapModel(
        message=trap.content,
        device_id=trap.device
    )

    db.add(db_syslog)
    await db.commit()
    await db.refresh(db_syslog)
    return db_syslog

def create_snmpTrapOid_in_file(name: str):
    print(f"Attempting to write '{name}' to JSON file.")

    if not SnmpTrapOidFile.exists():
        print(f"File {SnmpTrapOidFile} does not exist.")
        raise FileNotFoundError(f"{SnmpTrapOidFile} does not exist")

    with open(SnmpTrapOidFile, "r") as f:
        data = json.load(f)

    if any(m.get("name") == name for m in data.get("snmpTrapOids", [])):
        print(f"'{name}' already exists in the JSON file.")
        raise ValueError(f"Mnemonic '{name}' already exists in file")

    new_snmpTrapOid = {
        "name": name,
        "value": name,
    }

    data.setdefault("snmpTrapOids", []).append(new_snmpTrapOid)

    with open(SnmpTrapOidFile, "w") as f:
        json.dump(data, f, indent=4)

    print(f"Successfully wrote '{name}' to the JSON file.")

async def getTraps(db: AsyncSession, skip: int = 0, limit: int = 100):
    result = await db.execute(select(TrapModel).offset(skip).limit(limit))
    return result.scalars().all()

SNMP_TRAP_OID = "1.3.6.1.6.3.1.1.4.1.0"

async def checkOids(trap: TrapModel, db: AsyncSession):
    for oid, value in trap.content.items():
        if oid == SNMP_TRAP_OID:
            # Check if this value exists in TrapOID
            result = await db.execute(select(TrapOid).where(TrapOid.value == value))
            trap_oid_entry = result.scalar_one_or_none()
            if not trap_oid_entry:
                db.add(TrapOid(value=value))
        else:
            # Check if this oid exists in OID
            result = await db.execute(select(SNMPOID).where(SNMPOID.oid == oid))
            oid_entry = result.scalar_one_or_none()
            if not oid_entry:
                db.add(SNMPOID(oid=oid))

async def save_statefulrules_to_file(db: AsyncSession):
    try:
        result = await db.execute(
            select(StatefulTrapRule)
            .options(
                selectinload(StatefulTrapRule.opensignaltrap),
                selectinload(StatefulTrapRule.closesignaltrap),
                selectinload(StatefulTrapRule.devices),
            )
        )
        rules = result.scalars().all()

        rule_list = []
        for rule in rules:
            rule_list.append({
                "id": rule.id,
                "name": rule.name,
                "opensignaltrap": rule.opensignaltrap.name if rule.opensignaltrap else None,
                "closesignaltrap": rule.closesignaltrap.name if rule.closesignaltrap else None,
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

        STATEFUL_RULES_JSON_PATH = "/app/traps/statefulrules.json"
        os.makedirs(os.path.dirname(STATEFUL_RULES_JSON_PATH), exist_ok=True)

        with open(STATEFUL_RULES_JSON_PATH, "w") as f:
            json.dump(rule_list, f, indent=4)

        print(f"Stateful rules saved to: {STATEFUL_RULES_JSON_PATH}")

    except Exception as e:
        print(f"Error writing statefulrules.json: {e}")

async def remove_rule_from_json(rule_name: str):
    STATEFUL_RULES_JSON_PATH = "/app/traps/statefulrules.json"
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