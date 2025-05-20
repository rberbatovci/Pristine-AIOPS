import requests
from requests.auth import HTTPBasicAuth
import json

# === Configuration ===
ROUTER_IP = "192.168.1.211"
USERNAME = "admin"
PASSWORD = "admin"

# === RESTCONF URL and headers ===
url = f"https://{ROUTER_IP}/restconf/data/ietf-interfaces:interfaces"
headers = {
    "Accept": "application/yang-data+json",
    "Content-Type": "application/yang-data+json"
}

# === Disable SSL warnings (optional for self-signed certs) ===
requests.packages.urllib3.disable_warnings()

# === RESTCONF GET request ===
response = requests.get(url, auth=HTTPBasicAuth(USERNAME, PASSWORD), headers=headers, verify=False)

# === Handle response ===
if response.status_code == 200:
    interfaces = response.json()
    print(json.dumps(interfaces, indent=2))
else:
    print(f"Error: {response.status_code}")
    print(response.text)