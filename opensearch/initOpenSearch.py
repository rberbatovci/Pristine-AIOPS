# init_opensearch.py
import time
import requests

OPENSEARCH_URL = "http://OpenSearch:9200"

INDEXES = {
    "syslogs": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "traps": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "netflow": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "syslog-signals": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "trap-signals": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "cpu-utilization": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "memory-statistics": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "interface-statistics": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    },
    "bgp-connections-statistics": {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0
        }
    }
}

def wait_for_opensearch():
    for _ in range(30):  # Wait up to ~30s
        try:
            r = requests.get(OPENSEARCH_URL)
            if r.status_code == 200:
                print("OpenSearch is up.")
                return True
        except Exception as e:
            print("Waiting for OpenSearch...")
        time.sleep(1)
    raise Exception("OpenSearch did not become healthy in time.")

def create_index(name, body):
    url = f"{OPENSEARCH_URL}/{name}"
    r = requests.head(url)
    if r.status_code == 404:
        print(f"Creating index: {name}")
        response = requests.put(url, json=body)
        if response.status_code in [200, 201]:
            print(f"Index {name} created.")
        else:
            print(f"Failed to create index {name}: {response.text}")
    else:
        print(f"Index {name} already exists.")

def main():
    wait_for_opensearch()
    for name, body in INDEXES.items():
        create_index(name, body)

if __name__ == "__main__":
    main()
