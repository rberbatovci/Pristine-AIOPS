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
DATA_DIR = "/app/traps/rules"
FASTAPI_URL = "http://FastAPI:8000/traps/trapOids/"
KAFKA_SIGNAL_TOPIC = 'trap-signals'

run = True
msg_count = 0
total_latency = 0
snmpTrapOidSettings = []
trapTagSettings = []

producer = Producer({'bootstrap.servers': KAFKA_BROKER})


def shutdown(signum, frame):
    global run
    print("Shutting down...")
    run = False

data_stores = {
    "snmpTrapOids.json": "snmpTrapOidSettings",
    "trapTags.json": "trapTagSettings",
}

def load_json_file(file_path):
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"{file_path} not found. Returning empty list.")
        return []
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {file_path}. Returning empty list.")
        return []

def reload_all_data():
    global snmpTrapOidSettings, trapTagSettings
    print("Reloading all configuration data...")
    for file_name, global_var_name in data_stores.items():
        file_path = os.path.join(DATA_DIR, file_name)
        data = load_json_file(file_path)
        globals()[global_var_name] = data
        print(f"Reloaded data from {file_name} into {global_var_name}.")

    print(f"Current trapTagSettings after reload: {trapTagSettings}") # Added logging

    if run:
        threading.Timer(RELOAD_INTERVAL_SECONDS, reload_all_data).start()

def send_to_opensearch(json_doc):
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.post(OPENSEARCH_URL, headers=headers, data=json_doc)
        if response.status_code not in (200, 201):
            print(f"Failed to index: {response.text}")
        else:
            print(f"Indexed document to OpenSearch: {json_doc}")
    except requests.exceptions.ConnectionError as e:
        print(f"OpenSearch Connection Error: {e}")
    except Exception as e:
        print(f"OpenSearch Error: {e}")

async def create_snmpTrapOid_via_api(name):
    newSnmpTrapOid = {
        "name": name,
        "value": name,
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(FASTAPI_URL, json=newSnmpTrapOid) as resp:
            if resp.status in (200, 201):
                print(f"SNMP Trap OID '{name}' created via API.")
                return await resp.json()
            elif resp.status == 400:
                print(f"SNMP Trap OID '{name}' already exists (according to API).")
                return None
            else:
                error = await resp.text()
                print(f"Failed to create SNMP Trap OID via API: {resp.status} {error}")
                raise Exception(f"Failed to create SNMP Trap OID via API: {resp.status} {error}")


def handle_message(msg):
    global msg_count, total_latency

    try:
        trap_data = json.loads(msg)
        device = trap_data.get('device')
        snmpTrapOid = trap_data.get('SNMPv2-MIB::snmpTrapOID.0')
        print(f"Received SNMP Trap: {trap_data}")

        if not device:
            print(f"Could not determine source IP for indexing: {trap_data}")
            return

        processed_trap_data = trap_data.copy()
        processed_trap_data['@timestamp'] = datetime.utcnow().isoformat()

        id_string = f"{device}_{snmpTrapOid}"
        trap_id = hashlib.sha256(id_string.encode()).hexdigest()
        processed_trap_data['trap_id'] = trap_id

        # Process OID definition
        if snmpTrapOid:
            print(f"Received SNMP Trap OID: {snmpTrapOid}")
            snmpTrapOid_entry = next((item for item in snmpTrapOidSettings if item["name"] == snmpTrapOid), None)

            if not snmpTrapOid_entry:
                print(f"SNMP Trap OID '{snmpTrapOid}' not found in the list.")
                print(f"SNMP Trap OID '{snmpTrapOid}' not found locally, calling FastAPI to create...")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    created_snmpTrapOid = loop.run_until_complete(
                        create_snmpTrapOid_via_api(snmpTrapOid)
                    )
                    print(f"FastAPI create_snmpTrapOid response: {created_snmpTrapOid}")
                finally:
                    loop.close()
            else:
                print(f"SNMP Trap OID '{snmpTrapOid}' found in the list: {snmpTrapOid_entry}")
                
                # Tag processing
                if "tags" in snmpTrapOid_entry and snmpTrapOid_entry["tags"]:
                    for tag_name in snmpTrapOid_entry["tags"]:
                        tag_entry = next((item for item in trapTagSettings if item["name"] == tag_name), None)
                        if tag_entry and "oids" in tag_entry:
                            for oid in tag_entry["oids"]:
                                if 'content' in trap_data and oid in trap_data['content']:
                                    processed_trap_data[tag_name] = trap_data['content'][oid]
                                    print(f"Added tag '{tag_name}' with value '{trap_data['content'][oid]}'")
                                    break
                                else:
                                    print(f"OID '{oid}' not found in the trap data.")
                        else:
                            print(f"Tag '{tag_name}' not found in the list.")

                # Rule processing + send to Kafka
                if "rules" in snmpTrapOid_entry and snmpTrapOid_entry["rules"]:
                    for rule in snmpTrapOid_entry["rules"]:
                        if rule:
                            enrichedTrap = processed_trap_data.copy()
                            enrichedTrap["rule"] = rule

                            producer.produce(
                                KAFKA_SIGNAL_TOPIC,
                                value=json.dumps(enrichedTrap).encode('utf-8')
                            )
                            producer.flush()
                            print(f"Sent signal to trap-signal topic: {enrichedTrap}")
                        else:
                            print(f"Rule '{rule}' not found in the list.")

        # Finally send to OpenSearch (with tags and rule if added)
        json_doc_for_os = json.dumps(processed_trap_data)
        start = time.perf_counter()
        send_to_opensearch(json_doc_for_os)
        latency = time.perf_counter() - start

        total_latency += latency
        msg_count += 1
        print(f"[{msg_count}] Indexed trap from: {device} (Latency: {latency:.4f}s)")

    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
    except Exception as e:
        print(f"Message processing error: {e}")

def main():
    global snmpTrapOidSettings
    print("Starting SNMP Trap Consumer...")
    reload_all_data()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    consumer = Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': CONSUMER_GROUP,
        'auto.offset.reset': 'earliest'
    })

    consumer.subscribe([KAFKA_TOPIC])

    print(f"Python SNMP Trap Consumer started. Listening for messages on '{KAFKA_TOPIC}'...")

    try:
        while run:
            msg = consumer.poll(timeout=1.0)
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f"Kafka error: {msg.error()}")
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
                        print(f"UnicodeDecodeError: Could not decode message with UTF-8 or Latin-1: {e}")
                    except json.JSONDecodeError as e:
                        print(f"JSON decode error after encoding attempts: {e}")
                except json.JSONDecodeError as e:
                    print(f"JSON decode error after Latin-1 decoding: {e}")
            time.sleep(0.01)

    except KeyboardInterrupt:
        pass
    except KafkaException as e:
        print(f"Kafka consumer error: {e}")
    finally:
        consumer.close()
        print("SNMP Trap Consumer stopped.")

if __name__ == "__main__":
    main()
