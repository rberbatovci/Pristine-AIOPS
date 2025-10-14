import os
from fastapi import APIRouter, HTTPException, Depends
from app.devices import models, schemas
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import subprocess

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # Points to app/devices

default_features = {
    "syslogs": False,
    "snmp_traps": False,
    "netflow": False,
    "telemetry": {
        "system_util": False,
        "interface_stats": False
    }
}

telemetry_playbook_map = {
    "syslogs": os.path.join(BASE_DIR, '..', 'ansible', 'xe-syslogs.yml'),
    "snmp_traps": os.path.join(BASE_DIR, '..', 'ansible', 'xe-snmptraps.yml'),
    "netflow": os.path.join(BASE_DIR, '..', 'ansible', 'xe-netflow.yml'),
    "system_util": os.path.join(BASE_DIR, '..', 'ansible', 'xe-system-util.yml'),
    "isis_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-isis-statistics.yml'),
    "ospf_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-ospf-statistics.yml'),
    "lldp_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-lldp-statistics.yml'),
    "interface_stats": os.path.join(BASE_DIR, '..', 'ansible', 'xe-interface-stats.yml'),
    "bgp_connections": os.path.join(BASE_DIR, '..', 'ansible', 'xe-bgp-connections.yml'),
    "rib_table": os.path.join(BASE_DIR, '..', 'ansible', 'rib-table.yml'),
    "fib_entry": os.path.join(BASE_DIR, '..', 'ansible', 'fib-entry.yml')
}

async def configureDevice(router_ip: str, playbook: str, extra_vars: dict):
    cmd = [
        "ansible-playbook",
        playbook,
        "-i", f"{router_ip},",
        "--extra-vars", json.dumps(extra_vars)
    ]

    env = os.environ.copy()
    env["ANSIBLE_HOST_KEY_CHECKING"] = "False"

    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)

    print(f"Ansible stdout:\n{process.stdout}")
    print(f"Ansible stderr:\n{process.stderr}")
    print(f"Ansible returncode: {process.returncode}")

    return {
        "stdout": process.stdout,
        "stderr": process.stderr,
        "returncode": process.returncode
    }

@router.post("/devices/{hostname}/configure/{feature_name}/", response_model=schemas.DeviceResponse)
async def configure_telemetry_feature(
    hostname: str,
    feature_name: str,
    db: AsyncSession = Depends(get_db)
):
    playbook = telemetry_playbook_map.get(feature_name)
    if not playbook:
        raise HTTPException(status_code=400, detail=f"Unsupported telemetry feature: {feature_name}")

    result = await db.execute(select(models.Device).where(models.Device.hostname == hostname))
    device = result.scalars().first()

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    vars = {
        "router_ip": device.ip_address,
        "username": os.getenv("SSH_USERNAME"),
        "password": os.getenv("SSH_PASSWORD"),
        "receiver_ip": os.getenv("RECEIVING_ADDRESS"),
    }

    if feature_name == "syslogs":
        vars.update({"receiver_port": os.getenv("SYSLOG_PORT"), 
                     "syslog_severity": os.getenv("SYSLOG_SEVERITY", 
                                                  "notifications")})
    elif feature_name == "snmp_traps":
        vars.update({"receiver_port": os.getenv("SNMP_TRAP_PORT"), 
                     "snmp_user": os.getenv("SNMP_USERNAME"),
                     "snmp_engine_id": os.getenv("SNMP_ENGINE_ID"),
                     "snmp_priv_pass": os.getenv("SNMP_PRIV_PASS"),
                     "snmp_auth_pass": os.getenv("SNMP_AUTH_PASS")})
    elif feature_name == "netflow":
        vars.update({"receiver_port": os.getenv("NETFLOW_PORT")})
    else:
        vars.update({
            "receiver_port": os.getenv("TELEMETRY_PORT"),
            "telemetry_period_seconds": os.getenv("TELEMETRY_PERIOD_SECONDS", "3000"),
        })

    ansible_result = await configureDevice(
        router_ip=device.ip_address,
        playbook=playbook,
        extra_vars=vars,
    )

    if ansible_result["returncode"] != 0:
        raise HTTPException(
            status_code=500,
            detail={
                "error": ansible_result["stderr"],
                "output": ansible_result["stdout"]
            },
        )

    if device.features is None:
        device.features = {}

    if feature_name in ["syslogs", "snmp_traps", "netflow"]:
        device.features[feature_name] = True
    else:
        telemetry = device.features.get("telemetry", {}) or {}
        telemetry[feature_name] = True
        device.features["telemetry"] = telemetry

    db.add(device)
    await db.commit()
    await db.refresh(device)

    return device
