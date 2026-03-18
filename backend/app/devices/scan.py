from kafka import KafkaProducer
import json
from fastapi import APIRouter, HTTPException
from ipaddress import ip_network

producer = KafkaProducer(
    bootstrap_servers="kafka:9092",
    value_serializer=lambda v: json.dumps(v).encode("utf-8"),
)

router = APIRouter()

@router.post("/scan")
def scan_network(target: str):
    try:
        # ✅ Validate CIDR
        ip_network(target, strict=False)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid network")

    # Send job to Kafka
    producer.send("nmap-jobs", {"target": target})

    return {"status": "Scan started", "target": target}