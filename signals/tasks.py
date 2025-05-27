from celery import Celery
import requests
import logging
import os

CELERY_BROKER = os.environ.get('CELERY_BROKER', 'redis://Redis:6379/0')
app = Celery('tasks', broker=CELERY_BROKER)

SYSLOG_SIGNALS_INDEX = 'syslog-signals'
TRAP_SIGNALS_INDEX = 'trap-signals'
OPENSEARCH_HOST = 'http://OpenSearch:9200'

# --- Logger for syslog signals ---
syslog_logger = logging.getLogger('syslog_signals')
syslog_logger.setLevel(logging.INFO)
syslog_handler = logging.FileHandler('syslog_signals.log')
syslog_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
syslog_handler.setFormatter(syslog_formatter)
syslog_logger.addHandler(syslog_handler)
syslog_logger.propagate = False # Prevent propagation to the root logger

# --- Logger for trap signals ---
trap_logger = logging.getLogger('trap_signals')
trap_logger.setLevel(logging.INFO)
trap_handler = logging.FileHandler('trap_signals.log')
trap_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
trap_handler.setFormatter(trap_formatter)
trap_logger.addHandler(trap_handler)
trap_logger.propagate = False # Prevent propagation to the root logger


@app.task
def promote_syslog_signals_to_open(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "warmUp":
            syslog_logger.info(f"Signal {signal_id} (syslog) status is '{signal.get('status')}', not 'warmUp'; skipping promotion to 'open'")
            return

        update_url = f'{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "open"}})
        response.raise_for_status()
        syslog_logger.info(f"Signal {signal_id} (syslog) promoted to 'open'")

    except Exception as e:
        syslog_logger.error(f"Failed to promote syslog signal {signal_id} to open: {e}")


@app.task
def promote_syslog_signals_to_closed(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "coolDown":
            syslog_logger.info(f"Signal {signal_id} (syslog) status is '{signal.get('status')}', not 'coolDown'; skipping promotion to 'closed'")
            return

        update_url = f'{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "closed"}})
        response.raise_for_status()
        syslog_logger.info(f"Signal {signal_id} (syslog) promoted to 'closed'")

    except Exception as e:
        syslog_logger.error(f"Failed to promote syslog signal {signal_id} to closed: {e}")


@app.task
def promote_trap_signals_to_open(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "warmUp":
            trap_logger.info(f"Signal {signal_id} (trap) status is '{signal.get('status')}', not 'warmUp'; skipping promotion to 'open'")
            return

        update_url = f'{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "open"}})
        response.raise_for_status()
        trap_logger.info(f"Signal {signal_id} (trap) promoted to 'open'")

    except Exception as e:
        trap_logger.error(f"Failed to promote trap signal {signal_id} to open: {e}")


@app.task
def promote_trap_signals_to_closed(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "coolDown":
            trap_logger.info(f"Signal {signal_id} (trap) status is '{signal.get('status')}', not 'coolDown'; skipping promotion to 'closed'")
            return

        update_url = f'{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "closed"}})
        response.raise_for_status()
        trap_logger.info(f"Signal {signal_id} (trap) promoted to 'closed'")

    except Exception as e:
        trap_logger.error(f"Failed to promote trap signal {signal_id} to closed: {e}")