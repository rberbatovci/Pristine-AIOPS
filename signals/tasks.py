from celery import Celery
import requests
import logging

app = Celery('tasks', broker='redis://Redis:6379/0')

LOG_FILE = 'syslog_signals.log'
LOG_LEVEL = logging.INFO
OPENSEARCH_INDEX = 'syslog-signals'
OPENSEARCH_HOST = 'http://OpenSearch:9200'

logging.basicConfig(filename=LOG_FILE, level=LOG_LEVEL,
                    format='%(asctime)s - %(levelname)s - %(message)s')


@app.task
def promote_signal_to_open(signal_id):
    try:
        # Step 1: Get current signal document
        get_url = f"{OPENSEARCH_HOST}/{OPENSEARCH_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        # Step 2: Check if status is still 'warmUp'
        if signal.get("status") != "warmUp":
            logging.info(f"Signal {signal_id} status is '{signal.get('status')}', not 'warmUp'; skipping promotion to 'open'")
            return

        # Step 3: Promote to 'open'
        update_url = f'{OPENSEARCH_HOST}/{OPENSEARCH_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "open"}})
        response.raise_for_status()
        logging.info(f"Signal {signal_id} promoted to 'open'")

    except Exception as e:
        logging.error(f"Failed to promote signal {signal_id} to open: {e}")


@app.task
def promote_signal_to_closed(signal_id):
    try:
        # Step 1: Get current signal document
        get_url = f"{OPENSEARCH_HOST}/{OPENSEARCH_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        # Step 2: Check if status is still 'coolDown'
        if signal.get("status") != "coolDown":
            logging.info(f"Signal {signal_id} status is '{signal.get('status')}', not 'coolDown'; skipping promotion to 'closed'")
            return

        # Step 3: Promote to 'closed'
        update_url = f'{OPENSEARCH_HOST}/{OPENSEARCH_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "closed"}})
        response.raise_for_status()
        logging.info(f"Signal {signal_id} promoted to 'closed'")

    except Exception as e:
        logging.error(f"Failed to promote signal {signal_id} to closed: {e}")
