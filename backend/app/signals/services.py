import json
import os
from sqlalchemy import select
from .models import SyslogSignalSeverity

MnemonicsJson = "/app/syslogs/rules/mnemonics.json"

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

