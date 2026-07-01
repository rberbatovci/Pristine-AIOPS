import uuid
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
import nmap

router = APIRouter(
    prefix="/api/scans",
    tags=["devices", "network", "scans"]
)

# Initialize the Nmap PortScanner
nm = nmap.PortScanner()

# Simple in-memory DB to store scan statuses and results
SCANS_DB = {}

# --- Pydantic Schemas ---
class NetworkScanRequest(BaseModel):
    target_range: str = Field(..., description="CIDR range or IP, e.g., 192.168.1.0/24")

class DeviceScanRequest(BaseModel):
    ip_address: str = Field(..., description="Single IP address to scan deeply, e.g., 192.168.1.50")

# --- Background Worker Functions ---
def run_network_sweep(scan_id: str, target_range: str):
    """Performs a fast ping sweep to discover live hosts."""
    try:
        SCANS_DB[scan_id]["status"] = "running"
        # -sn: Ping scan (Disable port scan, just find live hosts)
        nm.scan(hosts=target_range, arguments="-sn")
        
        discovered_devices = []
        for host in nm.all_hosts():
            discovered_devices.append({
                "ip": host,
                "hostname": nm[host].hostname(),
                "state": nm[host].state()
            })
            
        SCANS_DB[scan_id]["status"] = "completed"
        SCANS_DB[scan_id]["results"] = discovered_devices
    except Exception as e:
        SCANS_DB[scan_id]["status"] = "failed"
        SCANS_DB[scan_id]["error"] = str(e)

def run_deep_device_scan(scan_id: str, ip_address: str):
    """Performs an advanced scan (OS detection, service versions, scripts)."""
    try:
        SCANS_DB[scan_id]["status"] = "running"
        # -A: Enable OS detection, version detection, script scanning, and traceroute
        # -T4: Faster execution timing
        nm.scan(hosts=ip_address, arguments="-A -T4")
        
        if ip_address not in nm.all_hosts():
            SCANS_DB[scan_id]["status"] = "completed"
            SCANS_DB[scan_id]["results"] = {"message": f"Host {ip_address} appeared offline during deep scan."}
            return

        host_data = nm[ip_address]
        scan_results = {
            "ip": ip_address,
            "state": host_data.state(),
            "os_match": host_data.get("osmatch", []),
            "protocols": {}
        }
        
        # Parse open ports and services
        for proto in host_data.all_protocols():
            scan_results["protocols"][proto] = []
            ports = host_data[proto].keys()
            for port in ports:
                port_info = host_data[proto][port]
                scan_results["protocols"][proto].append({
                    "port": port,
                    "name": port_info.get("name"),
                    "product": port_info.get("product"),
                    "version": port_info.get("version"),
                    "state": port_info.get("state")
                })

        SCANS_DB[scan_id]["status"] = "completed"
        SCANS_DB[scan_id]["results"] = scan_results
    except Exception as e:
        SCANS_DB[scan_id]["status"] = "failed"
        SCANS_DB[scan_id]["error"] = str(e)


# --- API Endpoints ---

@router.post("/network-sweep", status_code=202)
def start_network_sweep(request: NetworkScanRequest, background_tasks: BackgroundTasks):
    """Trigger a quick ping sweep over a network range to find alive hosts."""
    scan_id = str(uuid.uuid4())
    SCANS_DB[scan_id] = {"status": "pending", "type": "network_sweep", "results": None}
    
    # Hand off the heavy lifting to the background worker
    background_tasks.add_task(run_network_sweep, scan_id, request.target_range)
    
    return {"scan_id": scan_id, "status": "pending", "message": "Network sweep started in background."}

@router.post("/device-deep", status_code=202)
def start_device_scan(request: DeviceScanRequest, background_tasks: BackgroundTasks):
    """Trigger an advanced, deep scan (-A) on a single chosen device."""
    scan_id = str(uuid.uuid4())
    SCANS_DB[scan_id] = {"status": "pending", "type": "device_deep", "results": None}
    
    # Hand off the deep scan to the background worker
    background_tasks.add_task(run_deep_device_scan, scan_id, request.ip_address)
    
    return {"scan_id": scan_id, "status": "pending", "message": "Deep device scan started in background."}

@router.get("/{scan_id}")
def get_scan_status(scan_id: str):
    """Check the status or fetch the results of any scan."""
    if scan_id not in SCANS_DB:
        raise HTTPException(status_code=404, detail="Scan ID not found")
    return SCANS_DB[scan_id]