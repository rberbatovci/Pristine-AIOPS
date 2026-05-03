from fastapi import APIRouter, Depends, HTTPException, Query, Body 
from typing import List
from app.db.session import opensearch_client
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/events/syslogs/statistics",
    tags=["syslogs,events/statistics"],
)

signalsRouter = APIRouter(
    prefix="/api/signals/syslogs/statistics",
    tags=["syslogs,signals,statistics"],
)

TOP_LEVEL_FIELDS = [ "mnemonic", "device", "severity" ]

@router.get("/{key}")
def get_field_statistics(key: str, user: dict = Depends(get_current_user)):
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

@signalsRouter.get("/devices")
def get_device_statistics(user: dict = Depends(get_current_user)):
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

@signalsRouter.get("/mnemonics")
def get_mnemonic_statistics(user: dict = Depends(get_current_user)):
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

@signalsRouter.get("/rules")
def get_rule_statistics(user: dict = Depends(get_current_user)):
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


@signalsRouter.get("/status")
def get_syslog_status_statistics(user: dict = Depends(get_current_user)):
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

@signalsRouter.get("/severity")
def get_trap_severity_statistics(user: dict = Depends(get_current_user)):
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

@signalsRouter.get("/affected-entities/{entity_key}")
def get_affected_entity_statistics(entity_key: str, user: dict = Depends(get_current_user)):
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
