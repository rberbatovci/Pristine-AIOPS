from ncclient import manager

with manager.connect(host="192.168.1.213", port=830, username="admin", password="admin", hostkey_verify=False) as m:
    filter = """
    <filter xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
        <bgp-state-data xmlns="http://cisco.com/ns/yang/Cisco-IOS-XE-bgp-route-oper"/>
    </filter>
    """
    response = m.get(filter=filter)
    print(response.xml)