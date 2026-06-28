import json
import subprocess
import redis
from kafka import KafkaConsumer

# 1. Configuration Constants
KAFKA_BROKER = "kafka:9092"
TOPIC = "nmap-jobs"
REDIS_HOST = "redis"
REDIS_PORT = 6379

print("🚀 Initializing Nmap worker dependencies...", flush=True)

# 2. Initialize Redis Client
try:
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
    # Ping to verify connection on startup
    r.ping()
    print("✅ Connected to Redis successfully.", flush=True)
except Exception as e:
    print(f"❌ Failed to connect to Redis: {e}", flush=True)

# 3. Initialize Kafka Consumer
# Using value_deserializer to automatically parse incoming bytes to JSON dicts
consumer = KafkaConsumer(
    TOPIC,
    bootstrap_servers=KAFKA_BROKER,
    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
    group_id="nmap-group",
    auto_offset_reset="earliest",
)

def parse_nmap_grepable(stdout):
    """Parses live hosts out of Nmap's grepable (-oG) standard output."""
    live_hosts = []
    for line in stdout.splitlines():
        if "Host:" in line and "Status: Up" in line:
            parts = line.split()
            if len(parts) > 1:
                ip = parts[1]
                live_hosts.append(ip)
    return live_hosts

def run_nmap(target):
    """Executes a fast ping scan (-sn) on the target network range."""
    # -sn: Ping scan (No port scan, fast host discovery)
    # -oG -: Output results in Grepable format directly to stdout
    cmd = ["nmap", "-sn", "-oG", "-", target]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ Nmap process execution failed for {target}: {e.stderr}", flush=True)
        return None
    except Exception as e:
        print(f"❌ Unexpected system error running Nmap on {target}: {e}", flush=True)
        return None

print("📡 Nmap worker is online and listening for jobs...", flush=True)

# 4. Main Event Loop
# KafkaConsumer object behaves like a blocking iterator natively
for message in consumer:
    data = message.value
    # Gracefully accept either 'target' or 'subnet' keys from the JSON data
    target = data.get("target") or data.get("subnet")

    if not target:
        print("⚠️ Received a job payload missing 'target' or 'subnet' keys. Skipping.", flush=True)
        continue

    print(f"\n🔍 Processing scan request for: {target}", flush=True)

    # Execute the scanner
    raw_output = run_nmap(target)

    if raw_output is not None:
        # Extract live IPs
        discovered_hosts = parse_nmap_grepable(raw_output)
        
        # Prepare structured response payload
        results_payload = {
            "target": target,
            "status": "completed",
            "hosts_found": len(discovered_hosts),
            "hosts": discovered_hosts
        }
        
        try:
            # Persistent Cache Strategy: Save full raw text output to Redis using target as the key
            r.set(f"scan:raw:{target}", raw_output)
            
            # Pub/Sub Streaming Strategy: Fire event to 'scan:results' channel for Frontend WebSockets
            r.publish("device_updates", json.dumps({
                "type": "nmap_scan",
                "payload": results_payload
            }))
            
            print(f"✅ Successfully processed {target}. Found {len(discovered_hosts)} live hosts.", flush=True)
            print(f"   ↳ Live IPs: {discovered_hosts}", flush=True)
            
        except Exception as redis_error:
            print(f"⚠️ Nmap complete, but Redis caching/publishing failed: {redis_error}", flush=True)
    else:
        # Handle failure state tracking
        failure_payload = {
            "target": target,
            "status": "failed",
            "hosts_found": 0,
            "hosts": []
        }
        try:
            r.publish("scan:results", json.dumps(failure_payload))
        except Exception:
            pass