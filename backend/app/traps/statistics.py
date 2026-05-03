from typing import List
from fastapi import APIRouter, status, HTTPException, Query, Depends
from app.db.session import opensearch_client
from app.auth.keycloak import get_current_user, require_admin

# Router instance
router = APIRouter(
    prefix="/api/events/traps/statistics",
    tags=["traps,events/statistics"],
)

signalsRouter = APIRouter(
    prefix="/api/signals/traps/statistics",
    tags=["traps,signals,statistics"],
)

TOP_LEVEL_FIELDS = [ "snmpTrapOid", "device"]

# ======================
# SQLAlchemy Model
# ======================
@router.get("/{tag_key}")
def get_tag_statistics(tag_key: str, user: dict = Depends(get_current_user)):
    query = {
        "size": 0,
        "aggs": {
            "tag_value_counts": {
                "terms": {
                    "field": f"{tag_key}",
                    "size": 1000
                }
            }
        }
    }

    response = opensearch_client.search(index="traps", body=query)
    stats = [
        {"value": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["tag_value_counts"]["buckets"]
    ]
    return {"tag_key": tag_key, "statistics": stats}

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
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "device",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_device"]["buckets"]
        ]
    }

@signalsRouter.get("/snmpTrapOid")
def get_snmp_oid_statistics(user: dict = Depends(get_current_user)):
    query = {
        "size": 0,
        "aggs": {
            "by_snmpTrapOid": {
                "terms": {
                    "field": "snmpTrapOid",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "snmpTrapOid",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_snmpTrapOid"]["buckets"]
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
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "rule",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_rule"]["buckets"]
        ]
    }


@signalsRouter.get("/status")
def get_trap_status_statistics(user: dict = Depends(get_current_user)):
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
    response = opensearch_client.search(index="trap-signals", body=query)
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
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "severity",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_severity"]["buckets"]
        ]
    }


@signalsRouter.get("/affected-entities/{entity_key}")
def get_affected_entity_statistics(entity_key: str, user: dict = Depends(get_current_user)):
    index_name = "trap-signals"
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


