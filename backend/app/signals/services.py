import json
import os
from sqlalchemy import select
from .models import SyslogSignalSeverity
import redis

MnemonicsJson = "/app/syslogs/rules/mnemonics.json"

def save_syslog_severity_to_redis(number: int, severity: str, description: str):
    r = redis.Redis(host='redis', port=6379, decode_responses=True)
    key = "syslog:signal:severity"
    r.hset(key, mapping={
        "number": number,
        "severity": severity,
        "description": description,
    })


async def updateMnemonicSettings(db):
    # Read the current file if it exists, otherwise start with an empty structure
    if os.path.exists(MnemonicsJson):
        with open(MnemonicsJson, "r") as f:
            data = json.load(f)
    else:
        data = {
            "mnemonics": [],
            "severity": {
                "minimum": "",
                "description": ""
            }
        }

    # Fetch the current severity settings from the database
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()

    if settings:
        # Only update severity
        data["severity"] = {
            "minimum": settings.number,
            "description": settings.description
        }

    # Write the updated data back to the file
    with open(MnemonicsJson, "w") as f:
        json.dump(data, f, indent=2)

