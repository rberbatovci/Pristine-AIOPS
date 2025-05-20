# syslog_utils.py

import re
from datetime import datetime
from typing import Tuple

def extract_mnemonic(message: str) -> Tuple[str | None, str | None, int | None]:
    severity_levels = {
        0: "Emergency", 1: "Alert", 2: "Critical", 3: "Error",
        4: "Warning", 5: "Notice", 6: "Informational", 7: "Debugging"
    }
    try:
        match = re.search(r'(%[^:]+):', message)
        if not match:
            return None, None, None

        mnemonic = match.group(1)

        severity_match = re.search(r'%[^-]+-(\d+)-[^:]+', mnemonic)
        if severity_match:
            severity_level = int(severity_match.group(1))
            severity_name = severity_levels.get(severity_level, "Unknown")
        else:
            severity_level = None
            severity_name = None

        return mnemonic, severity_name, severity_level
    except TypeError as e:
        print(f"TypeError in extract_mnemonic: {e}")
        return None, None, None
    except Exception as e:
        print(f"Error in extract_mnemonic: {e}")
        return None, None, None

def extract_timestamp(message: str) -> datetime | None:
    try:
        match = re.search(r'([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})', message)
        if match:
            month_str, day_str, time_str = match.groups()
            try:
                current_year = datetime.now().year
                datetime_str = f"{current_year} {month_str} {day_str} {time_str}"
                return datetime.strptime(datetime_str, "%Y %b %d %H:%M:%S.%f")
            except ValueError as e:
                print(f"ValueError in extract_timestamp: {e}")
                return None
            except Exception as e:
                print(f"Error during datetime parsing: {e}")
                return None
        return None
    except TypeError as e:
        print(f"TypeError in extract_timestamp: {e}")
        return None
    except Exception as e:
        print(f"Error in extract_timestamp: {e}")
        return None

def extract_lsn(message: str) -> int | None:
    try:
        match = re.search(r'^<\d+>(\d+):', message.strip())
        return int(match.group(1)) if match else None
    except TypeError as e:
        print(f"TypeError in extract_lsn: {e}")
        return None
    except AttributeError as e:
        print(f"AttributeError in extract_lsn: {e}")
        return None
    except ValueError as e:
        print(f"ValueError in extract_lsn: {e}")
        return None
    except Exception as e:
        print(f"Error in extract_lsn: {e}")
        return None