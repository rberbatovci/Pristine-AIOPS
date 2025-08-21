from fastapi import APIRouter, HTTPException, Query, Body 
from typing import List
from app.db.session import opensearch_client

router = APIRouter()

TOP_LEVEL_FIELDS = [ "mnemonic", "device", "severity" ]

def get_unique_terms(index: str, field: str, size: int = 1000) -> List[str]:
    try:
        response = opensearch_client.search(
            index=index,
            size=0,
            body={
                "aggs": {
                    "unique_terms": {
                        "terms": {
                            "field": field,
                            "size": size
                        }
                    }
                }
            }
        )
        buckets = response["aggregations"]["unique_terms"]["buckets"]
        return [bucket["key"] for bucket in buckets]
    except Exception as e:
        logger.exception("Error during OpenSearch aggregation")
        raise HTTPException(status_code=500, detail=f"Error getting terms: {str(e)}")

@router.get("/syslogs/tags/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate")):
    # Determine actual field path for aggregation
    if field in TOP_LEVEL_FIELDS:
        field_path = field
    else:
        field_path = f"tags.{field}"

    try:
        return get_unique_terms(index="syslogs", field=field_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/syslogs/statistics/{key}")
def get_field_statistics(key: str):
    # Fields like 'severity', 'device', etc. should use .keyword
    field_path = f"{key}" if key in TOP_LEVEL_FIELDS else f"tags.{key}"

    query = {
        "size": 0,
        "aggs": {
            "value_counts": {
                "terms": {
                    "field": field_path,
                    "size": 1000
                }
            }
        }
    }

    response = opensearch_client.search(index="syslogs", body=query)

    buckets = response.get("aggregations", {}).get("value_counts", {}).get("buckets", [])
    stats = [{"value": b["key"], "count": b["doc_count"]} for b in buckets]

    return {"key": key, "statistics": stats}

@router.get("/signals/syslogs/devices/statistics")
def get_device_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_device": {
                "terms": {
                    "field": "device",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return {
        "tag_key": "device",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_device"]["buckets"]
        ]
    }

@router.get("/signals/syslogs/mnemonics/statistics")
def get_mnemonic_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_mnemonic": {
                "terms": {
                    "field": "mnemonics",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return {
        "tag_key": "mnemonic",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_mnemonic"]["buckets"]
        ]
    }

@router.get("/signals/syslogs/rules/statistics")
def get_rule_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_rule": {
                "terms": {
                    "field": "rule",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return {
        "tag_key": "rule",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_rule"]["buckets"]
        ]
    }


@router.get("/signals/syslogs/status/statistics")
def get_syslog_status_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_status": {
                "terms": {
                    "field": "status",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return {
        "tag_key": "status",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_status"]["buckets"]
        ]
    }

@router.get("/signals/syslogs/severity/statistics")
def get_trap_severity_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_severity": {
                "terms": {
                    "field": "severity",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return {
        "tag_key": "severity",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_severity"]["buckets"]
        ]
    }

@router.get("/signals/syslogs/affected-entities/statistics/{entity_key}")
def get_affected_entity_statistics(entity_key: str):
    index_name = "syslog-signals"
    field_path = f"affectedEntities.{entity_key}"

    query = {
        "size": 0,
        "aggs": {
            "by_tag_value": {
                "terms": {
                    "field": field_path,
                    "size": 1000
                }
            }
        }
    }

    response = opensearch_client.search(index=index_name, body=query)
    return {
        "tag_key": entity_key,
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_tag_value"]["buckets"]
        ]
    }
