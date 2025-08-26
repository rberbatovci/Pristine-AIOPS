from typing import List
from fastapi import APIRouter, status, HTTPException, Query
from app.db.session import opensearch_client

# Router instance
router = APIRouter()

TOP_LEVEL_FIELDS = [ "snmpTrapOid", "device"]

# ======================
# SQLAlchemy Model
# ======================
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
        raise HTTPException(status_code=500, detail=f"Error getting terms: {str(e)}")

@router.get("/traps/tags/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate")):
    # Determine actual field path for aggregation
    if field in TOP_LEVEL_FIELDS:
        field_path = field
    else:
        field_path = f"content.{field}"

    try:
        return get_unique_terms(index="traps", field=field_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/traps/tags/statistics/{tag_key}")
def get_tag_statistics(tag_key: str):
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

@router.get("/signals/traps/devices/statistics")
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
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "device",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_device"]["buckets"]
        ]
    }



@router.get("/signals/traps/snmpTrapOid/statistics")
def get_snmp_oid_statistics():
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


@router.get("/signals/traps/rules/statistics")
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
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "rule",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_rule"]["buckets"]
        ]
    }


@router.get("/signals/traps/status/statistics")
def get_trap_status_statistics():
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

@router.get("/signals/traps/severity/statistics")
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
    response = opensearch_client.search(index="trap-signals", body=query)
    return {
        "tag_key": "severity",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_severity"]["buckets"]
        ]
    }


@router.get("/signals/traps/affected-entities/statistics/{entity_key}")
def get_affected_entity_statistics(entity_key: str):
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


