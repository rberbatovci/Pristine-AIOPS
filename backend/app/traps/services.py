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
from typing import Any
import redis
import psycopg2
from psycopg2.extras import RealDictCursor

TrapTagFile = "/app/traps/rules/trapTags.json"
SnmpTrapOidFile = Path("/app/traps/rules/snmpTrapOids.json")
StatefulRulesFile = Path("/app/signals/rules/statefulTrapRules.json")

def add_tag_to_redis(name: str, oids: list[str]):
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    key = f"traps:tags:{name}"

    r.hset(key, mapping={
        "name": name,
        "oids": ",".join(oids)
    })

    r.sadd("traps:tags:all", name)

def update_tag_in_redis(name: str, oids: list[str]):
    add_tag_to_redis(name, oids)  # same as add (overwrites existing)

def delete_tag_from_redis(regex_name):
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    key = f"traps:tags:{regex_name}"
    r.delete(key)
    r.srem("traps:tags:all", regex_name)

def sync_tags_to_redis():
    conn = psycopg2.connect(
        dbname="fpristine",
        user="PristineAdmin",
        password="PristinePassword",
        host="postgresql"
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    r = redis.Redis(host='redis', port=6379, decode_responses=True)

    # Clear previous trapTags from Redis
    for key in r.scan_iter("traps:tags:*"):
        r.delete(key)
    r.delete("traps:tags:all")

    # Fetch data from PostgreSQL
    cursor.execute('SELECT * FROM "trapTags";')
    tags = cursor.fetchall()

    # Store in Redis
    for tag in tags:
        key = f"traps:tags:{tag['name']}"
        r.hset(key, mapping={
            'name': tag['name'],
            'oids': ','.join(tag['oids']) if tag['oids'] else ''
        })
        r.sadd("traps:tags:all", tag['name'])

    conn.close()

def sync_snmp_trap_oids_to_redis():
    conn = psycopg2.connect(
        dbname="fpristine",
        user="PristineAdmin",
        password="PristinePassword",
        host="postgresql"
    )
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    r = redis.Redis(host='redis', port=6379, decode_responses=True)

    # Clear previous SNMP Trap OID entries
    for key in r.scan_iter("traps:oid:*"):
        r.delete(key)
    r.delete("traps:oid:all")

    # Fetch rows from PostgreSQL
    cursor.execute("SELECT * FROM snmp_trap_oids;")
    rows = cursor.fetchall()

    # Store each row in Redis
    for row in rows:
        key = f"traps:oid:{row['id']}"
        r.hset(key, mapping={
            'id': row['id'],
            'name': row['name'] or '',
            'tags': ','.join(row['tags']) if row['tags'] else ''
        })
        r.sadd("traps:oid:all", row['id'])

    conn.close()

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
    # Create the file if it does not exist
    if not os.path.exists(SnmpTrapOidFile):
        with open(SnmpTrapOidFile, "w") as f:
            json.dump([], f)  # initialize with empty list or dict

    # Read safely
    with open(SnmpTrapOidFile, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            data = []  # or {} depending on your structure

    # Modify the data
    data.append({"name": name, "value": name, "tags": [], "rules": []})

    # Save back to file
    with open(SnmpTrapOidFile, "w") as f:
        json.dump(data, f, indent=2)

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

        os.makedirs(os.path.dirname(StatefulRulesFile), exist_ok=True)

        with open(StatefulRulesFile, "w") as f:
            json.dump(rule_list, f, indent=4)

        print(f"Stateful rules saved to: {StatefulRulesFile}")

    except Exception as e:
        print(f"Error writing statefulrules.json: {e}")

async def remove_rule_from_snmpTrapOid(rule_name: str):
    try:
        # Load the JSON file
        if not SnmpTrapOidFile.exists():
            raise FileNotFoundError(f"{SnmpTrapOidFile} not found.")

        with SnmpTrapOidFile.open("r") as f:
            trap_oids = json.load(f)

        # Remove the rule name from any trap's rules list
        for trap in trap_oids:
            if rule_name in trap.get("rules", []):
                trap["rules"].remove(rule_name)

        # Write the updated data back
        with SnmpTrapOidFile.open("w") as f:
            json.dump(trap_oids, f, indent=2)

    except Exception as e:
        print(f"Error removing rule from JSON: {e}")
        raise

async def remove_rule_from_json(rule_name: str):
    print(f">>> Attempting to remove rule '{rule_name}' from JSON")

    try:
        if not os.path.exists(StatefulRulesFile):
            print(f">>> File does not exist: {StatefulRulesFile}")
            return

        with open(StatefulRulesFile, "r") as f:
            rules = json.load(f)

        print(f">>> Loaded {len(rules)} rule(s) from JSON")

        # Filter out the rule with the matching name
        updated_rules = [rule for rule in rules if rule["name"] != rule_name]

        if len(updated_rules) == len(rules):
            print(f">>> No rule named '{rule_name}' found in JSON.")
        else:
            with open(StatefulRulesFile, "w") as f:
                json.dump(updated_rules, f, indent=4)
            print(f">>> Rule '{rule_name}' removed and JSON updated")

    except Exception as e:
        print(f">>> Error removing rule from {StatefulRulesFile}")
        traceback.print_exc()

def save_tags_to_json_file(tag_data: dict, json_path: str = TrapTagFile) -> None:
    try:
        os.makedirs(os.path.dirname(json_path), exist_ok=True)
        path = Path(json_path)

        if path.exists():
            with open(path, "r+", encoding="utf-8") as file:
                try:
                    data = json.load(file)
                    if not isinstance(data, list):
                        data = [data]
                    data.append(tag_data)
                except json.JSONDecodeError:
                    data = [tag_data]

                file.seek(0)
                json.dump(data, file, indent=4)
                file.truncate()
        else:
            with open(path, "w", encoding="utf-8") as file:
                json.dump([tag_data], file, indent=4)

        print(f"Tag saved to: {json_path}")

    except Exception as e:
        print(f"Error writing tag to JSON: {e}")

def update_tag_in_json_file(name: str, new_oids: Any, json_path: str = TrapTagFile) -> None:
    """
    Find the tag by `name` in the JSON file and replace its `oids` value.
    """
    path = Path(json_path)
    if not path.exists():
        return

    with path.open("r+", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return

        if isinstance(data, list):
            for entry in data:
                if entry.get("name") == name:
                    entry["oids"] = new_oids
                    break
        else:
            if data.get("name") == name:
                data["oids"] = new_oids

        f.seek(0)
        json.dump(data, f, indent=4)
        f.truncate()

def delete_tag_from_json_file(name: str, json_path: str = TrapTagFile) -> None:
    """
    Remove any entry with `name` from the JSON file.
    """
    path = Path(json_path)
    if not path.exists():
        return

    with path.open("r+", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return

        if isinstance(data, list):
            data = [entry for entry in data if entry.get("name") != name]
        else:
            # if single object matches name, clear it
            if data.get("name") == name:
                data = []

        f.seek(0)
        json.dump(data, f, indent=4)
        f.truncate()

def update_snmptrap_oid_json_file(trap_oid: TrapOid):
    """
    Updates the snmpTrapOid.json file with the latest tag info for a given trap OID.
    If the OID exists, it's updated; if not, it's added.
    """
    # Load existing data
    if os.path.exists(SnmpTrapOidFile):
        with open(SnmpTrapOidFile, "r") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                data = []
    else:
        data = []

    # Update or insert trap OID entry
    updated = False
    for entry in data:
        if entry.get("name") == trap_oid.name:
            entry["tags"] = trap_oid.tags
            updated = True
            break

    if not updated:
        data.append({
            "name": trap_oid.name,
            "tags": trap_oid.tags
        })

    # Write back to file
    with open(SnmpTrapOidFile, "w") as f:
        json.dump(data, f, indent=2)

def update_snmpTrapOid_tags_in_file(trap_oid_name: str, tags: list[str]) -> None:
    if not os.path.exists(SnmpTrapOidFile):
        raise FileNotFoundError(f"{SnmpTrapOidFile} does not exist")

    with open(SnmpTrapOidFile, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON format in snmpTrapOids.json")

    updated = False
    for oid_entry in data:
        if oid_entry.get("name") == trap_oid_name:
            oid_entry["tags"] = tags
            updated = True
            break

    if not updated:
        raise ValueError(f"Trap OID with name '{trap_oid_name}' not found in JSON file")

    with open(SnmpTrapOidFile, "w") as f:
        json.dump(data, f, indent=2)

async def update_trap_rules_in_json(opensignaltrap_name: str, closesignaltrap_name: str, rule_name: str):
    try:
        # Load the JSON file
        if not SnmpTrapOidFile.exists():
            raise FileNotFoundError(f"{SnmpTrapOidFile} not found.")

        with SnmpTrapOidFile.open("r") as f:
            trap_oids = json.load(f)

        # Update rules for open and close traps
        for trap in trap_oids:
            if trap["name"] == opensignaltrap_name or trap["name"] == closesignaltrap_name:
                if rule_name not in trap["rules"]:
                    trap["rules"].append(rule_name)

        # Write the updated data back
        with SnmpTrapOidFile.open("w") as f:
            json.dump(trap_oids, f, indent=2)

    except Exception as e:
        print(f"Error updating trap rules in JSON: {e}")
        raise

