import re
from sqlalchemy.orm import Session
from .models import Syslog, Mnemonic
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from app.signals.models import SyslogSignal
from sqlalchemy.orm import selectinload

def extract_mnemonic(message: str) -> str | None:
    match = re.search(r'(%[^:]+):', message)
    if match:
        return match.group(1)
    return None

def extract_severity(mnemonic_name: str) -> tuple[str, str] | tuple[None, None]:
    """Extracts severity number from mnemonic and returns (number, level) or (None, None) if not found"""
    severity_levels = {
        0: "Emergency",
        1: "Alert",
        2: "Critical",
        3: "Error",
        4: "Warning",
        5: "Notice",
        6: "Informational",
        7: "Debugging"
    }
    
    match = re.search(r'%[^-]+-(\d+)-[^:]+', mnemonic_name)
    if match:
        severity_num = int(match.group(1))
        severity_level = severity_levels.get(severity_num, "Unknown")
        return str(severity_num), severity_level
    return None, None

async def get_active_syslog_signals_for_device(session, device_id: int):
    result = await session.execute(
        select(SyslogSignal)
        .where(
            SyslogSignal.device_id == device_id,
            SyslogSignal.state != 'closed'
        )
        .options(selectinload(SyslogSignal.events))  # optional: eager load events
    )
    return result.scalars().all()

async def checkMnemonic(syslog: Syslog, db: AsyncSession):
    mnemonic_name = extract_mnemonic(syslog.message)
    if mnemonic_name:
        syslog.mnemonic = mnemonic_name
        result = await db.execute(select(Mnemonic).filter(Mnemonic.name == mnemonic_name))
        mnemonic = result.scalar_one_or_none()
        
        if mnemonic:
            print(f"Mnemonic '{mnemonic_name}' found in the database.")
        else:
            # Extract severity information
            severity_num, severity_level = extract_severity(mnemonic_name)
            
            new_mnemonic = Mnemonic(
                name=mnemonic_name,
                severity=severity_level  # Set the severity level
            )
            db.add(new_mnemonic)
            await db.commit()
            await db.refresh(new_mnemonic)
            
            if severity_level:
                print(f"Mnemonic '{mnemonic_name}' created with severity {severity_level}.")
            else:
                print(f"Mnemonic '{mnemonic_name}' created (no severity detected).")
    else:
        print("No mnemonic found in syslog message.")

async def checkTimestamp(syslog: Syslog, db: AsyncSession):
    match = re.search(r'([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})', syslog.message)
    if match:
        month_str, day_str, time_str = match.groups()
        try:
            # Assuming the year is the current year. This might need adjustments.
            current_year = datetime.now().year
            datetime_str = f"{current_year} {month_str} {day_str} {time_str}"
            timestamp = datetime.strptime(datetime_str, "%Y %b %d %H:%M:%S.%f")
            syslog.timestamp = timestamp
        except ValueError as e:
            print(f"Error parsing timestamp: {e}")
        except Exception as e:
            print(f"General error:{e}")

async def checkLSN(syslog: Syslog, db: AsyncSession) -> None:
    """
    Extracts and updates the LSN (Log Sequence Number) from the syslog message.
    """
    def extract_lsn(message: str) -> int | None:
        lsn_match = re.search(r'^<\d+>(\d+):', message.strip())
        return int(lsn_match.group(1)) if lsn_match else None

    try:
        if lsn := extract_lsn(syslog.message):
            syslog.lsn = lsn
    except (ValueError, AttributeError) as e:
        print(f"LSN extraction failed: {e}")
    except Exception as e:
        print(f"Unexpected error updating LSN: {e}")