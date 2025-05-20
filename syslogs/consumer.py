import json
import re
import time
import signal
import sys
import requests
from datetime import datetime
from confluent_kafka import Consumer, KafkaException, Producer
from utils import extract_mnemonic, extract_timestamp, extract_lsn
import aiohttp
import asyncio
import os
import threading
import logging  # Import the logging module
import hashlib

FASTAPI_URL = "http://FastAPI:8000/syslogs/mnemonics/"
DATA_DIR = "/app/syslogs"
RELOAD_INTERVAL_SECONDS = 60

KAFKA_SIGNAL_TOPIC = 'syslog-signals'
KAFKA_BROKER = 'Kafka:9092'
KAFKA_TOPIC = 'syslog-topic'
OPENSEARCH_URL = 'http://OpenSearch:9200/syslogs/_doc/'
CONSUMER_GROUP = 'syslog-consumer-group'
LOG_FILE = 'syslog_consumer.log'
LOG_LEVEL = logging.INFO

logging.basicConfig(filename=LOG_FILE, level=LOG_LEVEL,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Syslog Consumer started.")

producer = Producer({'bootstrap.servers': KAFKA_BROKER})

run = True
msg_count = 0
total_latency = 0
mnemonics_data = []
regex_data = []
severity_minimum = 0
severity_description = ""

def shutdown(signum, frame):
    global run
    logging.info("Shutting down...")
    run = False

def load_json_file(file_name):
    file_path = os.path.join(DATA_DIR, file_name)
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logging.warning(f"{file_path} not found. Returning empty dict.")
        return {}
    except json.JSONDecodeError:
        logging.warning(f"Error decoding JSON from {file_path}. Returning empty dict.")
        return {}

def reload_data():
    global mnemonics_data, regex_data, severity_minimum, severity_description
    logging.info("Reloading mnemonics and regex data...")
    data = load_json_file("mnemonics.json")
    mnemonics_data = data.get("mnemonics", [])
    severity_info = data.get("severity", {})
    severity_minimum = severity_info.get("minimum", 0)
    severity_description = severity_info.get("description", "")
    regex_data = load_json_file("regex_data.json")
    if run:
        threading.Timer(RELOAD_INTERVAL_SECONDS, reload_data).start()

def save_syslog(syslogJSON, doc_id=None):
    try:
        headers = {'Content-Type': 'application/json'}

        if doc_id:
            url = f"{OPENSEARCH_URL.rstrip('/')}/{doc_id}"
            response = requests.put(url, headers=headers, data=syslogJSON.encode('utf-8'))
        else:
            response = requests.post(OPENSEARCH_URL, headers=headers, data=syslogJSON.encode('utf-8'))

        if response.status_code not in (200, 201):
            logging.error(f"Failed to index to OpenSearch: {response.text}")
    except Exception as e:
        logging.error(f"OpenSearch Error: {e}")

def extract_data_using_regex(regex_name, message):
    for regex_entry in regex_data:
        if regex_entry["name"] == regex_name:
            pattern = regex_entry["pattern"]
            match_function = regex_entry.get("matchfunction", "search")
            group_number = regex_entry.get("groupnumber", 1)

            if match_function == "search":
                match = re.search(pattern, message)
                if match:
                    return match.group(group_number)
    return "NoMatch"

async def create_mnemonic_via_api(mnemonic_name, severity, severity_level):
    newMnemonic = {
        "name": mnemonic_name,
        "level": severity_level,
        "severity": severity,
        "regexes": [],
        "rules": [],
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(FASTAPI_URL, json=newMnemonic) as resp:
            if resp.status in (200, 201):
                logging.info(f"Mnemonic '{mnemonic_name}' created via API.")
                return await resp.json()
            elif resp.status == 400:
                logging.info(f"Mnemonic '{mnemonic_name}' already exists (according to API).")
                return None
            else:
                error = await resp.text()
                logging.error(f"Failed to create mnemonic via API: {resp.status} {error}")
                raise Exception(f"Failed to create mnemonic via API: {resp.status} {error}")

def handle_message(msg):
    global msg_count, total_latency

    try:
        payload = json.loads(msg.value().decode('utf-8'))
        device = payload.get("device")
        message = payload.get("message")

        if not device or not message:
            logging.warning("Device or message missing in payload.")
            return

        logging.info(f"Processing message for device: {device}")
        mnemonic, severity, severity_level = extract_mnemonic(message)
        timestamp = extract_timestamp(message)
        lsn = extract_lsn(message)

        id_string = f"{device}_{timestamp}_{mnemonic}_{lsn}_{message}"
        syslog_id = hashlib.sha256(id_string.encode()).hexdigest()


        enrichedSyslog = {
            "syslog_id": syslog_id,
            "device": device,
            "message": message,
            "mnemonic": mnemonic,
            "severity": severity,
            "@timestamp": timestamp.isoformat() if timestamp else None,
            "lsn": lsn
        }

        if mnemonic:
            mnemonic_entry = next((item for item in mnemonics_data if item["name"] == mnemonic), None)

            if not mnemonic_entry:
                logging.info(f"Mnemonic '{mnemonic}' not found locally, calling FastAPI to create...")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    created_mnemonic = loop.run_until_complete(
                        create_mnemonic_via_api(mnemonic, severity, severity_level)
                    )
                    logging.info(f"FastAPI create_mnemonic response: {created_mnemonic}")
                finally:
                    loop.close()

            mnemonic_entry = next((item for item in mnemonics_data if item["name"] == mnemonic), None)
            if mnemonic_entry and "regexes" in mnemonic_entry:
                for regex_name in mnemonic_entry["regexes"]:
                    extracted_value = extract_data_using_regex(regex_name, message)
                    for regex_entry_data in regex_data:
                        if regex_entry_data["name"] == regex_name:
                            tag = regex_entry_data.get("tag", regex_name)
                            enrichedSyslog[tag] = extracted_value
                            break

            if mnemonic_entry and "rules" in mnemonic_entry and mnemonic_entry["rules"]:
                for rule in mnemonic_entry["rules"]:
                    # Clone the enriched syslog to avoid modifying the original
                    enriched_signal = enrichedSyslog.copy()
                    enriched_signal["rule"] = rule

                    producer.produce(
                        KAFKA_SIGNAL_TOPIC,
                        value=json.dumps(enriched_signal).encode('utf-8')
                    )
                    producer.flush()
                    logging.info(f"Sent signal to syslogs-signal topic: {enriched_signal}")

            if severity_level <= severity_minimum:
                enriched_signal = enrichedSyslog.copy()
                enriched_signal["rule"] = 'Severity'
                producer.produce(KAFKA_SIGNAL_TOPIC, value=json.dumps(enriched_signal).encode('utf-8'))
                producer.flush()
                logging.info(f"Sent signal for {device} (severity level {severity_level})")

        save_syslog(json.dumps(enrichedSyslog), syslog_id)
        msg_count += 1
        logging.info(f"Indexed message to OpenSearch: {json.dumps(enrichedSyslog)}")

    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error: {e}")
    except Exception as e:
        logging.error(f"Message processing error: {e}")

def main():
    global mnemonics_data, regex_data, severity_minimum, severity_description

    logging.info("Starting syslog consumer...")
    data = load_json_file("mnemonics.json")
    mnemonics_data = data.get("mnemonics", [])
    severity_info = data.get("severity", {})
    severity_minimum = severity_info.get("minimum", 0)
    severity_description = severity_info.get("description", "")
    regex_data = load_json_file("regex_data.json")

    threading.Timer(RELOAD_INTERVAL_SECONDS, reload_data).start()

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    consumer_config = {
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': CONSUMER_GROUP,
        'auto.offset.reset': 'earliest'
    }
    consumer = Consumer(consumer_config)
    consumer.subscribe([KAFKA_TOPIC])

    logging.info("Syslog consumer started. Waiting for messages...")

    try:
        while run:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                logging.error(f"Consumer error: {msg.error()}")
                continue

            handle_message(msg)

    except KeyboardInterrupt:
        logging.info("Interrupted by user.")

    finally:
        consumer.close()
        if msg_count > 0:
            logging.info(f"Average indexing latency: {total_latency / msg_count:.4f}s")
        else:
            logging.info("No messages processed.")
        logging.info("Consumer closed.")

if __name__ == "__main__":
    main()