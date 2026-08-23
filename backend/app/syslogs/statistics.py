from fastapi import APIRouter, Depends, HTTPException, Query, Body 
from typing import List, Optional
from datetime import datetime
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

def build_field_lookup_table() -> dict[str, str]:
    """
    Inspects OpenSearch index mapping and creates a case-insensitive 
    lookup table for ALL index properties (top-level + nested tags).
    """
    lookup = {}

    try:
        mapping = opensearch_client.indices.get_mapping(index="syslogs")
        properties = (
            mapping
            .get("syslogs", {})
            .get("mappings", {})
            .get("properties", {})
        )

        for field_name, field_meta in properties.items():
            if field_name == "tags":
                tag_properties = field_meta.get("properties", {})
                for tag_key in tag_properties.keys():
                    lookup[tag_key.lower()] = f"tags.{tag_key}"
            else:
                # Top-level text fields need .keyword for terms aggregations
                if field_meta.get("type") == "text" and "keyword" in field_meta.get("fields", {}):
                    lookup[field_name.lower()] = f"{field_name}.keyword"
                else:
                    lookup[field_name.lower()] = field_name

    except Exception:
        pass

    return lookup


@router.get("/{field}")
def get_field_statistics(
    field: str,
    start_time: Optional[datetime] = Query(None, description="Filter start timestamp"),
    end_time: Optional[datetime] = Query(None, description="Filter end timestamp"),
    user: dict = Depends(get_current_user)
):
    lookup_table = build_field_lookup_table()
    field_lower = field.lower()

    # 1. Resolve OpenSearch target path
    if field_lower in lookup_table:
        target_field = lookup_table[field_lower]
    else:
        target_field = f"tags.{field}"

    # 2. Build time filter query clause
    filter_clauses = []
    if start_time or end_time:
        range_query = {}
        if start_time:
            range_query["gte"] = start_time.isoformat()
        if end_time:
            range_query["lte"] = end_time.isoformat()
        filter_clauses.append({"range": {"timestamp": range_query}})

    # 3. Construct OpenSearch Search Body
    query = {
        "size": 0,
        "query": {
            "bool": {
                "filter": filter_clauses if filter_clauses else [{"match_all": {}}]
            }
        },
        "aggs": {
            "value_counts": {
                "terms": {
                    "field": target_field,
                    "size": 100,
                    "missing": "N/A"
                }
            }
        }
    }

    try:
        response = opensearch_client.search(index="syslogs", body=query)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenSearch search failed: {str(e)}"
        )

    buckets = (
        response
        .get("aggregations", {})
        .get("value_counts", {})
        .get("buckets", [])
    )

    statistics = [
        {"value": bucket["key"], "count": bucket["doc_count"]}
        for bucket in buckets
    ]

    return {
        "requested_field": field,
        "resolved_target_field": target_field,
        "start_time": start_time,
        "end_time": end_time,
        "statistics": statistics
    }

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
