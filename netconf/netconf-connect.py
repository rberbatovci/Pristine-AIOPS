from ncclient import manager
import xml.dom.minidom

with manager.connect(
    host="192.168.1.212",
    port=830,
    username="admin",
    password="admin",
    hostkey_verify=False,
    device_params={'name': 'csr'}
) as m:
    running_config_xml = m.get_config(source='running').xml
    dom = xml.dom.minidom.parseString(running_config_xml)
    pretty_xml = dom.toprettyxml(indent="  ")
    print(pretty_xml)