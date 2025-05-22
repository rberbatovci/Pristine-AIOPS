import signal
import sys
import json
import time
import requests
import logging
from confluent_kafka import Consumer, KafkaException, KafkaError, Producer
from datetime import datetime
import os
import aiohttp
import threading
import asyncio
import hashlib

# Kafka configuration
KAFKA_BROKER = 'Kafka:9092'
KAFKA_TOPIC = 'trap-topic'
CONSUMER_GROUP = 'snmp-opensearch-consumer-group'
RELOAD_INTERVAL_SECONDS = 60
OPENSEARCH_URL = 'http://OpenSearch:9200/traps/_doc/'
DATA_DIR = "/app/traps"
FASTAPI_URL = "http://FastAPI:8000/traps/trapOids/"
KAFKA_SIGNAL_TOPIC = 'trap-signals'

run = True
msg_count = 0
total_latency = 0
snmpTrapOidSettings = []
statefulRuleSettings = []
trapTagSettings = []

producer = Producer({'bootstrap.servers': KAFKA_BROKER})

LOG_FILE = 'snmptrap_consumer.log'
LOG_LEVEL = logging.INFO

# Logging configuration
logging.basicConfig(filename=LOG_FILE, level=LOG_LEVEL,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("SNMP Trap Consumer started.")

def shutdown(signum, frame):
    global run
    logging.info("Shutting down...")
    run = False

data_stores = {
    "snmpTrapOids.json": "snmpTrapOidSettings",
    "statefulrules.json": "statefulRuleSettings",
    "trapTags.json": "trapTagSettings",
}

def load_json_file(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.warning(f"{file_path} not found. Returning empty list.")
        return []
    except json.JSONDecodeError:
        logging.warning(f"Error decoding JSON from {file_path}. Returning empty list.")
        return []

def reload_all_data():
    global snmpTrapOidSettings, statefulRuleSettings, trapTagSettings
    logging.info("Reloading all configuration data...")
    for file_name, global_var_name in data_stores.items():
        file_path = os.path.join(DATA_DIR, file_name)
        data = load_json_file(file_path)
        globals()[global_var_name] = data
        logging.info(f"Reloaded data from {file_name} into {global_var_name}.")

    logging.info(f"Current trapTagSettings after reload: {trapTagSettings}") # Added logging

    if run:
        threading.Timer(RELOAD_INTERVAL_SECONDS, reload_all_data).start()

def send_to_opensearch(json_doc):
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.post(OPENSEARCH_URL, headers=headers, data=json_doc)
        if response.status_code not in (200, 201):
            logging.error(f"Failed to index: {response.text}")
        else:
            logging.info(f"Indexed document to OpenSearch: {json_doc}")
    except requests.exceptions.ConnectionError as e:
        logging.error(f"OpenSearch Connection Error: {e}")
    except Exception as e:
        logging.exception(f"OpenSearch Error: {e}")

async def create_snmpTrapOid_via_api(name):
    newSnmpTrapOid = {
        "name": name,
        "value": name,
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(FASTAPI_URL, json=newSnmpTrapOid) as resp:
            if resp.status in (200, 201):
                logging.info(f"SNMP Trap OID '{name}' created via API.")
                return await resp.json()
            elif resp.status == 400:
                logging.info(f"SNMP Trap OID '{name}' already exists (according to API).")
                return None
            else:
                error = await resp.text()
                logging.error(f"Failed to create SNMP Trap OID via API: {resp.status} {error}")
                raise Exception(f"Failed to create SNMP Trap OID via API: {resp.status} {error}")


def handle_message(msg):
    global msg_count, total_latency

    try:
        trap_data = json.loads(msg)
        source_ip = trap_data.get('source_ip')
        snmpTrapOid = trap_data.get('SNMPv2-MIB::snmpTrapOID.0')
        logging.info(f"Received SNMP Trap: {trap_data}")

        if snmpTrapOid:
            logging.info(f"Received SNMP Trap OID: {snmpTrapOid}")
            snmpTrapOid_entry = next((item for item in snmpTrapOidSettings if item["name"] == snmpTrapOid), None)

            if not snmpTrapOid_entry:
                logging.warning(f"SNMP Trap OID '{snmpTrapOid}' not found in the list.")
                logging.info(f"SNMP Trap OID '{snmpTrapOid}' not found locally, calling FastAPI to create...")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    created_snmpTrapOid = loop.run_until_complete(
                        create_snmpTrapOid_via_api(snmpTrapOid)
                    )
                    logging.info(f"FastAPI create_snmpTrapOid response: {created_snmpTrapOid}")
                finally:
                    loop.close()
            else:
                logging.info(f"SNMP Trap OID '{snmpTrapOid}' found in the list.")
                logging.info(f"SNMP Trap OID in the list: {snmpTrapOid_entry}")
                if snmpTrapOid_entry and "tags" in snmpTrapOid_entry and snmpTrapOid_entry["tags"]:
                    logging.info(f"Tags found for SNMP Trap OID '{snmpTrapOid}': {snmpTrapOid_entry['tags']}")
                    for tag_name in snmpTrapOid_entry["tags"]:
                        tag_entry = next((item for item in trapTagSettings if item["name"] == tag_name), None)
                        if tag_entry and "oids" in tag_entry:
                            logging.info(f"Tag '{tag_name}' found in the list with OIDs: {tag_entry['oids']}")
                            for oid in tag_entry["oids"]:
                                if 'content' in trap_data and oid in trap_data['content']:
                                    trap_data[tag_name] = trap_data['content'][oid]
                                    logging.info(f"Added tag '{tag_name}' with value '{trap_data['content'][oid]}'")
                                    break # Assuming you want the first match
                                else:
                                    logging.warning(f"OID '{oid}' not found in the trap data.")
                        else:
                            logging.warning(f"Tag '{tag_name}' not found in the list.")
                
                if snmpTrapOid_entry and "rules" in snmpTrapOid_entry and snmpTrapOid_entry["rules"]:
                    logging.info(f"Rules found for SNMP Trap OID '{snmpTrapOid}': {snmpTrapOid_entry['rules']}")
                    for rule in snmpTrapOid_entry["rules"]:
                        rule_entry = next((item for item in statefulRuleSettings if item["name"] == rule), None)
                        if rule_entry:
                            # Clone the enriched syslog to avoid modifying the original
                            enrichedTrap = trap_data.copy()
                            enrichedTrap["rule"] = rule

                            producer.produce(
                                KAFKA_SIGNAL_TOPIC,
                                value=json.dumps(enrichedTrap).encode('utf-8')
                            )
                            producer.flush()
                            logging.info(f"Sent signal to syslogs-signal topic: {enrichedTrap}")

                        else:
                            logging.warning(f"Rule '{rule}' not found in the list.")
        if source_ip:
            # Add a timestamp field
            id_string = f"{source_ip}_{snmpTrapOid}"
            trap_id = hashlib.sha256(id_string.encode()).hexdigest()
            trap_data['@timestamp'] = datetime.utcnow().isoformat()
            trap_data['trap_id'] = trap_id
            json_doc = json.dumps(trap_data)
            start = time.perf_counter()
            send_to_opensearch(json_doc)
            latency = time.perf_counter() - start

            total_latency += latency
            msg_count += 1

            logging.info(f"[{msg_count}] Indexed trap from: {source_ip} (Latency: {latency:.4f}s)")
        else:
            logging.warning(f"Could not determine source IP for indexing: {trap_data}")

    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error: {e}")
    except Exception as e:
        logging.exception(f"Message processing error: {e}")

def main():
    global snmpTrapOidSettings
    logging.info("Starting SNMP Trap Consumer...")
    reload_all_data()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    consumer = Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': CONSUMER_GROUP,
        'auto.offset.reset': 'earliest'
    })

    consumer.subscribe([KAFKA_TOPIC])

    logging.info(f"Python SNMP Trap Consumer started. Listening for messages on '{KAFKA_TOPIC}'...")

    try:
        while run:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    logging.error(f"Kafka error: {msg.error()}")
                    break

            if msg.value() is not None:
                try:
                    trap_data_str = msg.value().decode('latin-1')  # Try decoding with latin-1
                    handle_message(trap_data_str)
                except UnicodeDecodeError:
                    try:
                        trap_data_str = msg.value().decode('utf-8')  # Fallback to UTF-8
                        handle_message(trap_data_str)
                    except UnicodeDecodeError as e:
                        logging.error(f"UnicodeDecodeError: Could not decode message with UTF-8 or Latin-1: {e}")
                    except json.JSONDecodeError as e:
                        logging.error(f"JSON decode error after encoding attempts: {e}")
                except json.JSONDecodeError as e:
                    logging.error(f"JSON decode error after Latin-1 decoding: {e}")
            time.sleep(0.01)

    except KeyboardInterrupt:
        pass
    except KafkaException as e:
        logging.error(f"Kafka consumer error: {e}")
    finally:
        consumer.close()
        logging.info("SNMP Trap Consumer stopped.")

if __name__ == "__main__":
    main()
