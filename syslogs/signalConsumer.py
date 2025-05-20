import json
import signal
import sys
import time
import requests
from confluent_kafka import Consumer

KAFKA_BROKER = 'localhost:9092'
KAFKA_SIGNAL_TOPIC = 'syslog-signals-topic'
CONSUMER_GROUP = 'signal-consumer-group'
SIGNAL_OPENSEARCH_URL = 'http://localhost:9200/syslogsignals/_doc/'

run = True

def shutdown(signum, frame):
    global run
    print("Shutting down signal consumer...")
    run = False

def create_signal(enriched_syslog):
    try:
        headers = {'Content-Type': 'application/json'}
        response = requests.post(SIGNAL_OPENSEARCH_URL, headers=headers, data=json.dumps(enriched_syslog))
        if response.status_code not in (200, 201):
            print(f"Failed to create signal: {response.text}")
    except Exception as e:
        print(f"Error creating signal: {e}")

def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    consumer = Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': CONSUMER_GROUP,
        'auto.offset.reset': 'earliest'
    })

    consumer.subscribe([KAFKA_SIGNAL_TOPIC])
    print("Signal Consumer started. Waiting for messages...")

    try:
        while run:
            msg = consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error():
                print(f"Consumer error: {msg.error()}")
            else:
                try:
                    syslog = json.loads(msg.value().decode('utf-8'))
                    print(f"Received syslog for signal creation: {syslog}")
                    create_signal(syslog)
                except json.JSONDecodeError as e:
                    print(f"JSON decode error: {e}")

    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()
        print("Signal Consumer stopped.")

if __name__ == "__main__":
    main()