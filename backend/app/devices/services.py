from sqlalchemy.ext.asyncio import AsyncSession
from .models import Device
from .schemas import DeviceCreate, DeviceUpdate, DeviceUpdatePartial
from sqlalchemy import select
import requests
from requests.auth import HTTPBasicAuth
import aiohttp
import subprocess
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # Points to app/devices
syslogXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-syslogs.yml')
trapsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-snmptraps.yml')
netflowXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-netflow.yml')
syslogXRPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xr-syslogs.yml')
cpuUtilXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-cpu-util.yml')
memStatsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-memory-stats.yml')
interfaceStatsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-interface-stats.yml')
BGPConnectionsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-bgp-connections.yml')
ISISStatsXEPlaybook = os.path.join(BASE_DIR, '..', 'ansible', 'xe-isis-statistics.yml')

async def create_device_minimal(db: AsyncSession, device: DeviceCreate) -> Device:
    db_device = Device(**device.dict())
    db.add(db_device)
    await db.commit()
    await db.refresh(db_device)
    return db_device

async def get_devices(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[Device]:
    devices = await db.execute(select(Device).offset(skip).limit(limit))
    return devices.scalars().all()

async def get_device(db: AsyncSession, device_id: int) -> Device | None:
    return await db.get(Device, device_id)

async def get_device_by_hostname(db: AsyncSession, hostname: str) -> Device | None:
    return await db.get(Device, hostname)

async def delete_device_by_hostname(db: AsyncSession, hostname: str) -> bool:
    device = await db.get(Device, hostname)
    if device:
        await db.delete(device)
        await db.commit()
        return True
    return False

async def update_device_by_hostname(
    db: AsyncSession,
    hostname: str,
    device_update: DeviceUpdatePartial,
) -> Device | None:
    db_device = await db.get(Device, hostname)
    if db_device:
        for key, value in device_update.dict(exclude_unset=True).items():
            setattr(db_device, key, value)
        await db.commit()
        await db.refresh(db_device)
    return db_device

async def delete_device(db: AsyncSession, device_id: int) -> bool:
    device = await db.get(Device, device_id)
    if device:
        await db.delete(device)
        await db.commit()
        return True
    return False

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

async def configureSyslogsXE(router_ip, severity):
    cmd = [
        "ansible-playbook",
        syslogXEPlaybook,
        "-i", f"{router_ip},",
        "--extra-vars", json.dumps({
            "router_ip": router_ip,
            "username": "admin",
            "password": "cisco123",
            "syslog_host": "192.168.1.201",
            "syslog_port": "1160",
            "syslog_severity": severity
        })
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

async def configureTrapsXE(router_ip):
    cmd = [
        "ansible-playbook",
        trapsXEPlaybook,
        "-i", f"{router_ip},",
        "--extra-vars", json.dumps({
            "router_ip": router_ip,
            "username": "admin",
            "password": "cisco123",
            "snmp_trap_host": "192.168.1.201",
            "snmp_trap_port": 1161,
            "snmp_user": "SNMPv3",
            "snmp_auth_pass": "AuTH_P@55w0rd123!",
            "snmp_priv_pass": "PrIV@TE_P@55w0rd456!",
            "snmp_engine_id": "800000090300500000030000"
        })
    ]

    env = os.environ.copy()
    env["ANSIBLE_HOST_KEY_CHECKING"] = "False"

    process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)

    return {
        "stdout": process.stdout,
        "stderr": process.stderr,
        "returncode": process.returncode
    }

async def configureNetflowXE(router_ip, interfaces):
    cmd = [
        "ansible-playbook",
        netflowXEPlaybook,  # Define this as a constant path to your playbook
        "-i", f"{router_ip},",
        "--extra-vars", json.dumps({
            "router_ip": router_ip,
            "username": "admin",
            "password": "cisco123",
            "netflow_interfaces": interfaces
        })
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

async def configureSyslogsXR(router_ip, severity):
    cmd = [
        "ansible-playbook",
        syslogXRPlaybook,  # Replace with the actual path to your XR playbook
        "-i", f"{router_ip},",
        "--extra-vars", json.dumps({
            "router_ip": router_ip,
            "username": "admin",
            "password": "admin",
            "syslog_host": "192.168.1.201",
            "syslog_port": "1160",
            "syslog_severity": severity
        })
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
