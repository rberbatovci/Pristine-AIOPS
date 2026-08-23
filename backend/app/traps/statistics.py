from typing import List, Optional
from datetime import datetime
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

def build_field_lookup_table() -> dict[str, str]:
    """
    Inspects OpenSearch index mapping and creates a case-insensitive 
    lookup table for ALL index properties (top-level + nested tags).

    Example mapping output:
    {
        "device": "device",
        "snmpTrapOid": "snmpTrapOid", 
        "interface": "content.Interface",
        "state": "content.State",
        "neighbor": "content.Neighbor"
    }
    """
    lookup = {}

    try:
        mapping = opensearch_client.indices.get_mapping(index="traps")
        properties = (
            mapping
            .get("traps", {})
            .get("mappings", {})
            .get("properties", {})
        )

        for field_name, field_meta in properties.items():
            # Handle nested 'content' object properties dynamically
            if field_name == "content":
                tag_properties = field_meta.get("properties", {})
                for tag_key in tag_properties.keys():
                    lookup[tag_key.lower()] = f"content.{tag_key}"
            else:
                # Top-level field
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
    """
    Get top value counts for ANY requested field dynamically.
    Resolves automatically to top-level or tags.* based on OpenSearch mapping.
    """
    lookup_table = build_field_lookup_table()
    field_lower = field.lower()

    # 1. Resolve exact OpenSearch path (case-insensitive)
    if field_lower in lookup_table:
        target_field = lookup_table[field_lower]
    else:
        # Fallback heuristic for new/unmapped dynamic tag fields
        target_field = f"content.{field}"

    # 2. Build optional time filter
    filter_clauses = []
    if start_time or end_time:
        range_query = {}
        if start_time:
            range_query["gte"] = start_time.isoformat()
        if end_time:
            range_query["lte"] = end_time.isoformat()
        filter_clauses.append({"range": {"timestamp": range_query}})

    # 3. Construct OpenSearch Terms Aggregation
    query = {
        "size": 0,
        "query": {
            "bool": {
                "filter": filter_clauses or [{"match_all": {}}]
            }
        },
        "aggs": {
            "value_counts": {
                "terms": {
                    "field": target_field,
                    "size": 100
                }
            }
        }
    }

    try:
        response = opensearch_client.search(index="traps", body=query)
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


