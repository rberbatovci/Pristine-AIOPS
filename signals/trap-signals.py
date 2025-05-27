import json
import signal
import sys
from confluent_kafka import Consumer
import requests
import logging
import os
import hashlib
from datetime import datetime, timedelta
from celery import Celery
from tasks import promote_trap_signals_to_open, promote_trap_signals_to_closed

# === Configuration ===
KAFKA_BROKER = 'Kafka:9092'
SIGNAL_TOPIC = 'trap-signals'
OPENSEARCH_URL = 'http://OpenSearch:9200/trap-signals/_doc/'
OPENSEARCH_INDEX = 'trap-signals'
CONSUMER_GROUP = 'trap-signals-consumer-group'
STATEFUL_RULES_FILE = 'statefulTrapRules.json'
LOG_FILE = 'trap_signals.log'
LOG_LEVEL = logging.INFO
CELERY_BROKER = os.environ.get('CELERY_BROKER', 'redis://redis:6380/0')
CELERY_BACKEND = os.environ.get('CELERY_BACKEND', 'redis://redis:6380/0')

celery_app = Celery('trap_signals',
                    broker=CELERY_BROKER,
                    backend=CELERY_BACKEND,
                    include=['trap-signals'])

# === Global Variables ===
run = True
stateful_rules = []
active_signals = {}  # (optional local tracking)
logging.basicConfig(filename=LOG_FILE, level=LOG_LEVEL,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logging.info("Trap Signals Consumer started.")

# === Signal Handling ===
def shutdown(signum, frame):
    global run
    logging.info("Shutting down signal consumer...")
    run = False

# === Rule Loading ===
def load_stateful_rules():
    try:
        if os.path.exists(STATEFUL_RULES_FILE):
            with open(STATEFUL_RULES_FILE, 'r') as f:
                rules = json.load(f)
                return rules
        else:
            logging.warning(f"{STATEFUL_RULES_FILE} not found.")
            return []
    except json.JSONDecodeError as e:
        logging.error(f"Failed to parse {STATEFUL_RULES_FILE}: {e}")
        return []

# === Signal ID Utility ===
def generate_signal_id(snmpTrapOid, timestamp, rule_id):
    raw_string = f"{snmpTrapOid}-{timestamp}-{rule_id}"
    full_hash = hashlib.sha256(raw_string.encode()).hexdigest()
    return full_hash[:8] 

# === OpenSearch Operations ===
def save_signal(signal_json):
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.post(OPENSEARCH_URL, headers=headers, data=json.dumps(signal_json))
        if response.status_code not in (200, 201):
            logging.error(f"OpenSearch error (save): {response.status_code} - {response.text}")
        else:
            logging.info(f"Signal saved to OpenSearch: {signal_json}")
            return response.json().get('_id')
    except Exception as e:
        logging.error(f"Failed to save signal: {e}")
        return None


# === Signal Update Function ===
def update_signal(signal_id, update_data):
    url = f'http://OpenSearch:9200/{OPENSEARCH_INDEX}/_doc/{signal_id}/_update'
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.post(url, headers=headers, data=json.dumps({"doc": update_data}))
        if response.status_code != 200:
            logging.error(f"OpenSearch error (update): {response.status_code} - {response.text}")
        else:
            logging.info(f"Signal updated in OpenSearch: {signal_id} - {update_data}")
    except Exception as e:
        logging.error(f"Failed to update signal {signal_id}: {e}")

# === Find Related Signal Function ===
def find_related_signal(rule_name, device, affected_entities):
    must_clauses = [
        {"term": {"rule.keyword": rule_name}},
        {"term": {"device.keyword": device}}
    ]

    for key, value in affected_entities.items():
        must_clauses.append({
            "term": {f"affectedEntities.{key}.keyword": value}
        })

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "sort": [{"@startTime": {"order": "desc"}}],
        "size": 1
    }

    url = f'http://OpenSearch:9200/{OPENSEARCH_INDEX}/_search'
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, headers=headers, data=json.dumps(query))
        if response.status_code == 200:
            results = response.json()
            hits = results.get('hits', {}).get('hits', [])
            if hits:
                return hits[0]['_id'], hits[0]['_source']
        else:
            logging.error(f"OpenSearch error (find related): {response.status_code} - {response.text}")
    except Exception as e:
        logging.error(f"Error querying OpenSearch for related signal: {e}")
    return None, None

# === Signal Creation Function ===
def create_signal(trap, rule):

    snmpTrapOid = trap.get('SNMPv2-MIB::snmpTrapOID.0')
    
    affected_entity_values = {}
    for entity_type in rule.get("affectedentity", []):
        entity_value = trap.get(entity_type)
        if entity_value:
            affected_entity_values[entity_type] = entity_value

    if not affected_entity_values:
        logging.warning(f"No affected entities found in trap for rule: {rule['name']}")
        return

    signal_id = generate_signal_id(
        trap.get("snmpTrapOid"),
        trap.get("@timestamp"),
        rule["id"]
    )

    new_signal = {
        "signal_id": signal_id,
        "device": trap.get("device"),
        "rule": rule["name"],
        "snmpTrapOid": snmpTrapOid,
        "affectedEntities": affected_entity_values,
        "severity": rule.get("initialseverity"),
        "description": rule.get("description"),
        "@startTime": trap.get("@timestamp"),
        "endTime": rule.get("@timestamp"),
        "status": "warmUp",  # Initially warmUp
        "events": [trap.get("trap_id")],
    }
            
    opensearch_id = save_signal(new_signal)
    if opensearch_id:
        warmup_delay = rule.get("warmup", 0)
        promote_trap_signals_to_open.apply_async(args=[opensearch_id], countdown=warmup_delay)
        logging.info(f"Created signal (ID: {opensearch_id}) with warmUp={warmup_delay}s: {new_signal}")

# === Signal Reopening Function ===
def reopen_signal(signal, trap, rule):
    try:
        # Extract signal_id from signal object if needed
        if isinstance(signal, dict):
            signal_id = signal.get("signal_id")
        else:
            signal_id = signal

        if not signal_id:
            logging.error(f"No signal_id provided to reopen_signal.")
            return

        # Step 1: Find the document by signal_id
        search_url = f"http://OpenSearch:9200/{OPENSEARCH_INDEX}/_search"
        search_query = {
            "query": {
                "term": {
                    "signal_id.keyword": signal_id
                }
            }
        }

        headers = {'Content-Type': 'application/json'}
        search_response = requests.post(search_url, headers=headers, data=json.dumps(search_query))
        search_response.raise_for_status()

        search_result = search_response.json()
        hits = search_result.get("hits", {}).get("hits", [])
        if not hits:
            logging.error(f"No signal found with signal_id: {signal_id}")
            return

        hit = hits[0]
        doc_id = hit["_id"]
        source = hit["_source"]

        # Step 2: Update the events list
        updated_events = source.get("events", [])
        trap_id = trap.get("trap_id")
        if trap_id and trap_id not in updated_events:
            updated_events.append(trap_id)

        # Step 3: Prepare update payload
        update_data = {
            "doc": {
                "status": "open",
                "events": updated_events
            }
        }

        # Step 4: Send update request
        update_url = f"http://OpenSearch:9200/{OPENSEARCH_INDEX}/_update/{doc_id}"
        update_response = requests.post(update_url, headers=headers, data=json.dumps(update_data))
        update_response.raise_for_status()

        logging.info(f"Successfully reopened signal {signal_id} (_id: {doc_id}) and added trap {trap_id}")

    except Exception as e:
        logging.error(f"Error reopening signal {signal}: {e}")

# === Signal Closing Function ===
def close_signal(trap, rule, related_signal):
    related_signal_id = related_signal.get("signal_id")

    # Get the OpenSearch document _id using signal_id
    search_url = f'http://OpenSearch:9200/{OPENSEARCH_INDEX}/_search'
    search_query = {
        "query": {
            "term": {
                "signal_id.keyword": related_signal_id
            }
        }
    }

    headers = {'Content-Type': 'application/json'}
    try:
        search_response = requests.post(search_url, headers=headers, data=json.dumps(search_query))
        search_result = search_response.json()
        hits = search_result.get("hits", {}).get("hits", [])
        if not hits:
            logging.error(f"No document found with signal_id: {related_signal_id}")
            return

        doc_id = hits[0]["_id"]
        signal_doc = hits[0]["_source"]

        # Update the events list
        updated_events = signal_doc.get("events", [])
        if trap.get("trap_id") not in updated_events:
            updated_events.append(trap.get("trap_id"))

        update_data = {
            "status": "coolDown",
            "@endTime": trap.get("@timestamp"),
            "events": updated_events
        }

        # Call update_signal and promote using _id
        update_signal(doc_id, update_data)

        cooldown_delay = rule.get("cooldown", 0)
        promote_trap_signals_to_closed.apply_async(args=[doc_id], countdown=cooldown_delay)
        logging.info(f"Signal {related_signal_id} (_id={doc_id}) set to coolDown for {cooldown_delay}s before closing.")

    except Exception as e:
        logging.error(f"Failed to close signal {related_signal_id}: {e}")

# === Main Signal Handler ===
def handle_message(msg):
    try:
        raw_value = msg.value()
        if raw_value is None:
            logging.warning("Received empty message.")
            return

        try:
            trap = json.loads(raw_value.decode('utf-8'))
        except Exception as e:
            logging.error(f"JSON decoding failed: {e}. Raw message: {raw_value}")
            return

        if not isinstance(trap, dict):
            logging.error(f"Unexpected message format (not dict): {trap}")
            return

        trapRule = trap.get("rule")
        logging.info(f"Received rule: {trapRule}")


        rule = next(
            (rule for rule in stateful_rules if rule["name"] == trapRule),
            None
        )

        if rule:
            logging.info(f"Matched rule: {rule}")
            snmpTrapOid = trap.get('SNMPv2-MIB::snmpTrapOID.0')
            closeTag = rule.get("closesignaltag")
            openTag = rule.get("opensignaltag")

            affected_entity_values = {}
            for entity_type in rule.get("affectedentity", []):
                entity_value = trap.get(entity_type)
                if entity_value:
                    affected_entity_values[entity_type] = entity_value

            logging.info(f"Trap data: {trap}")
            logging.info(f"Extracted affected_entity_values: {affected_entity_values}") # Added logging
            logging.info(f"Trap SNMP Trap OID: {trap.get('SNMPv2-MIB::snmpTrapOID.0')}, Open Signal value: {rule.get('opensignaltrap')}: {trap.get(openTag)}")
            logging.info(f"Trap SNMP Trap OID: {trap.get('SNMPv2-MIB::snmpTrapOID.0')}, Close Signal value: {rule.get('closesignaltrap')}: {trap.get(closeTag)}")

            if rule.get("opensignaltrap") == trap.get('SNMPv2-MIB::snmpTrapOID.0'):
                if not openTag or rule.get("opensignalvalue") == trap.get(openTag):
                    logging.info(f"Trap eligible for opening signal: {trap.get(openTag)}: 1.{trapRule}, 2.{trap.get('device')}, 3.{affected_entity_values}")
                    related_signal_id, related_signal = find_related_signal(
                        trapRule, trap.get("device"), affected_entity_values
                    )
                    logging.info(f"Related signal ID: {related_signal_id}, Related signal: {related_signal}, Rule: {rule}, affected entities: {affected_entity_values}")
                    if related_signal is None or related_signal.get("status") == "closed":
                        logging.info("Creating new signal (no related or closed).")
                        create_signal(trap, rule)
                    elif related_signal.get("status") == "coolDown":
                        logging.info(f"Reopening signal {related_signal_id} (coolDown).")
                        reopen_signal(related_signal, trap, rule)
                    elif related_signal.get("status") == "open":
                        logging.error(f"Related signal {related_signal_id} is already open.")
                        logging.error(f"Related signal: {related_signal}")
                    return
            if rule.get("closesignaltrap") == trap.get('SNMPv2-MIB::snmpTrapOID.0'):
                if not closeTag or rule.get("closesignalvalue") == trap.get(closeTag):
                    logging.info(f"Trap elligible for closing signal: {trap.get(closeTag)}")
                    related_signal_id, related_signal = find_related_signal(
                        rule["name"], trap.get("device"), affected_entity_values # Use rule["name"] here
                    )
                    logging.info(f"Related signal ID: {related_signal_id}, Related signal: {related_signal}, Rule: {rule}, affected entities: {affected_entity_values}")
                    if related_signal is None:
                        logging.error("No related signal found to close.")
                    elif related_signal.get("status") == "warmUp":
                        logging.error(f"Signal {related_signal_id} in warmUp. Should be deleted.")
                    elif related_signal.get("status") == "open":
                        logging.info(f"Closing signal {related_signal_id}.")
                        close_signal(trap, rule, related_signal)
                    elif related_signal.get("status") == "coolDown":
                        logging.error(f"Signal {related_signal_id} is in coolDown. Cannot close.")
                    return

        else:
            logging.warning(f"No matching rule found for: {rule}. Trap message: {trap}")

    except Exception as e:
        logging.error(f"Unexpected error in handle_message: {e}")

# === Main Loop ===
def main():
    global stateful_rules
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    stateful_rules = load_stateful_rules()
    logging.info(f"Loaded {len(stateful_rules)} stateful rules.")

    consumer = Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': CONSUMER_GROUP,
        'auto.offset.reset': 'earliest'
    })

    consumer.subscribe([SIGNAL_TOPIC])
    logging.info(f"Subscribed to topic: {SIGNAL_TOPIC}")

    try:
        while run:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                logging.error(f"Consumer error: {msg.error()}")
                continue

            handle_message(msg)

    finally:
        consumer.close()
        logging.info("Signal consumer closed.")

if __name__ == "__main__":
    main()
    logging.info("Trap Signals Consumer started.")