from ncclient import manager

with manager.connect(
    host="192.168.1.212",
    port=830,
    username="admin",
    password="cisco123",
    hostkey_verify=False,
    allow_agent=False,
    look_for_keys=False,
    timeout=10
) as m:
    print("Connected")
    print(m.server_capabilities)