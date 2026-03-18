import json
import subprocess
from kafka import KafkaConsumer

KAFKA_BROKER = "kafka:9092"
TOPIC = "nmap-jobs"

consumer = KafkaConsumer(
    TOPIC,
    bootstrap_servers=KAFKA_BROKER,
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
    group_id="nmap-group",
    auto_offset_reset="earliest",
)

print("🚀 Nmap worker started...")

def run_nmap(target):
    try:
        result = subprocess.run(
            ["nmap", "-sV", "-oX", "-", target],
            capture_output=True,
            text=True
        )
        return result.stdout
    except Exception as e:
        return str(e)

for message in consumer:
    data = message.value
    target = data.get("target")

    print(f"📡 Scanning: {target}")

    output = run_nmap(target)

    # TODO: store in DB or send to another Kafka topic
    print(output[:500])  # preview only