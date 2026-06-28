import json
import logging
from fastapi import APIRouter, HTTPException, status
from ipaddress import ip_network
from kafka import KafkaProducer
from pydantic import BaseModel, field_validator

router = APIRouter(
    prefix="/api/devices",
    tags=["devices"],
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 1. Initialize Kafka Producer
# Using a try/except block ensures your API layer doesn't completely crash 
# on startup if Kafka is still booting up in Docker.
try:
    producer = KafkaProducer(
        bootstrap_servers="kafka:9092",
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        # Optimization: Acks=1 ensures the broker received the record before returning success
        acks=1, 
        retries=3
    )
    logger.info("✅ FastAPI Kafka Producer initialized successfully.")
except Exception as e:
    logger.error(f"❌ Failed to initialize Kafka Producer: {e}")
    producer = None
 

# 2. Pydantic Model for Strong Validation & Better API Docs (Swagger)
class ScanRequest(BaseModel):
    target: str

    @field_validator('target')
    def validate_cidr(cls, value):
        try:
            # Validates IPv4/IPv6 ranges and subnets properly
            ip_network(value, strict=False)
        except ValueError:
            raise ValueError("Invalid network target format. Must be a valid IP or CIDR range (e.g., 192.168.1.0/24).")
        return value


# 3. Optimized Async Endpoint
@router.post("/scan", status_code=status.HTTP_202_ACCEPTED)
async def scan_network(request: ScanRequest):
    """
    Accepts a network target/subnet range and schedules an asynchronous Nmap background scan 
    by distributing the work via Kafka.
    """
    if producer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Kafka broker is unreachable. Cannot schedule scan."
        )

    target = request.target

    try:
        # Send job to the exact Kafka topic the worker listens to
        # .get(timeout=5) blocks just long enough to verify Kafka acknowledged the write buffer
        future = producer.send("nmap-jobs", {"target": target})
        future.get(timeout=5) 
        
        logger.info(f"📡 Dispatched scan task to Kafka for target: {target}")
        
        # HTTP 202 Accepted is standard practice for asynchronous/queued jobs
        return {
            "status": "queued", 
            "target": target,
            "message": "Scan task has been successfully sent to the worker queue."
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to dispatch message to Kafka: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Failed to queue scan task: {str(e)}"
        )