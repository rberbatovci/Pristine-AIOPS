from celery import Celery
import requests
import os

CELERY_BROKER = os.environ.get('CELERY_BROKER', 'redis://Redis:6379/0')
app = Celery('tasks', broker=CELERY_BROKER)

SYSLOG_SIGNALS_INDEX = 'syslog-signals'
TRAP_SIGNALS_INDEX = 'trap-signals'
OPENSEARCH_HOST = 'http://OpenSearch:9200'


@app.task
def promote_syslog_signals_to_open(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "warmUp":
            print(f"[syslog] Signal {signal_id} status is '{signal.get('status')}', not 'warmUp'; skipping promotion to 'open'")
            return

        update_url = f'{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "open"}})
        response.raise_for_status()
        print(f"[syslog] Signal {signal_id} promoted to 'open'")

    except Exception as e:
        print(f"[syslog] Failed to promote signal {signal_id} to open: {e}")


@app.task
def promote_syslog_signals_to_closed(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "coolDown":
            print(f"[syslog] Signal {signal_id} status is '{signal.get('status')}', not 'coolDown'; skipping promotion to 'closed'")
            return

        update_url = f'{OPENSEARCH_HOST}/{SYSLOG_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "closed"}})
        response.raise_for_status()
        print(f"[syslog] Signal {signal_id} promoted to 'closed'")

    except Exception as e:
        print(f"[syslog] Failed to promote signal {signal_id} to closed: {e}")


@app.task
def promote_trap_signals_to_open(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "warmUp":
            print(f"[trap] Signal {signal_id} status is '{signal.get('status')}', not 'warmUp'; skipping promotion to 'open'")
            return

        update_url = f'{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "open"}})
        response.raise_for_status()
        print(f"[trap] Signal {signal_id} promoted to 'open'")

    except Exception as e:
        print(f"[trap] Failed to promote signal {signal_id} to open: {e}")


@app.task
def promote_trap_signals_to_closed(signal_id):
    try:
        get_url = f"{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}"
        get_response = requests.get(get_url)
        get_response.raise_for_status()
        signal = get_response.json()['_source']

        if signal.get("status") != "coolDown":
            print(f"[trap] Signal {signal_id} status is '{signal.get('status')}', not 'coolDown'; skipping promotion to 'closed'")
            return

        update_url = f'{OPENSEARCH_HOST}/{TRAP_SIGNALS_INDEX}/_doc/{signal_id}/_update'
        response = requests.post(update_url, json={"doc": {"status": "closed"}})
        response.raise_for_status()
        print(f"[trap] Signal {signal_id} promoted to 'closed'")

    except Exception as e:
        print(f"[trap] Failed to promote signal {signal_id} to closed: {e}")
