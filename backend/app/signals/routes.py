from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from app.signals.models import SyslogSignalSeverity
from app.signals.schemas import SyslogSignalSeverityBase
from app.syslogs.models import Mnemonic
from app.db.session import get_db, opensearch_client
from app.syslogs.services import update_mnemonics_list_in_json
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

router = APIRouter()

@router.get("/signals/syslogsignals/")
async def get_syslogSignals(page: int = Query(1, ge=1, description="Page number"),
                      page_size: int = Query(10, ge=1, le=100, description="Number of items per page")):
    start = (page - 1) * page_size
    body = {
        "query": {"match_all": {}},
        "from": start,
        "size": page_size
    }
    response = opensearch_client.search(
        index='syslog-signals',
        body=body
    )
    
    hits = response['hits']['hits']
    total = response['hits']['total']['value']  # Get total number of matching documents

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/signals/trapsignals/")
async def get_trapSignals(page: int = Query(1, ge=1, description="Page number"),
                      page_size: int = Query(10, ge=1, le=100, description="Number of items per page")):
    start = (page - 1) * page_size
    body = {
        "query": {"match_all": {}},
        "from": start,
        "size": page_size
    }
    response = opensearch_client.search(
        index='trap-signals',
        body=body
    )
    
    hits = response['hits']['hits']
    total = response['hits']['total']['value']  # Get total number of matching documents

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/signals/syslogs/devices/options")
def get_devices():
    query = {
        "size": 0,
        "aggs": {
            "devices": {
                "terms": {
                    "field": "device.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["devices"]["buckets"]]

@router.get("/signals/traps/devices/options")
def get_devices():
    query = {
        "size": 0,
        "aggs": {
            "devices": {
                "terms": {
                    "field": "device.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["devices"]["buckets"]]


@router.get("/signals/syslogs/rules/options")
def get_rules():
    query = {
        "size": 0,
        "aggs": {
            "rules": {
                "terms": {
                    "field": "rule.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["rules"]["buckets"]]

@router.get("/signals/traps/rules/options")
def get_rules():
    query = {
        "size": 0,
        "aggs": {
            "rules": {
                "terms": {
                    "field": "rule.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["rules"]["buckets"]]


@router.get("/signals/syslogs/mnemonics/options")
def get_mnemonics():
    query = {
        "size": 0,
        "aggs": {
            "mnemonics": {
                "terms": {
                    "field": "mnemonics.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["mnemonics"]["buckets"]]


@router.get("/signals/traps/snmpTrapOid/options")
def get_mnemonics():
    query = {
        "size": 0,
        "aggs": {
            "snmpTrapOid": {
                "terms": {
                    "field": "snmpTrapOid.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [bucket["key"] for bucket in response["aggregations"]["snmpTrapOid"]["buckets"]]


@router.get("/signals/syslogs/affected-entities/options/{entity_key}")
def get_affected_entity_values(entity_key: str):
    index_name = "syslog-signals"
    
    # Build the aggregation path dynamically
    agg_path = f"affectedEntities.{entity_key}"

    query = {
        "size": 0,
        "aggs": {
            "affected_entity_values": {
                "terms": {
                    "field": agg_path + ".keyword",  # use .keyword to aggregate strings
                    "size": 1000  # adjust as needed
                }
            }
        }
    }

    response = opensearch_client.search(index=index_name, body=query)
    values = [bucket["key"] for bucket in response["aggregations"]["affected_entity_values"]["buckets"]]
    return {"entity": entity_key, "values": values}

@router.get("/signals/traps/affected-entities/options/{entity_key}")
def get_affected_entity_values(entity_key: str):
    index_name = "trap-signals"
    
    # Build the aggregation path dynamically
    agg_path = f"affectedEntities.{entity_key}"

    query = {
        "size": 0,
        "aggs": {
            "affected_entity_values": {
                "terms": {
                    "field": agg_path + ".keyword",  # use .keyword to aggregate strings
                    "size": 1000  # adjust as needed
                }
            }
        }
    }

    response = opensearch_client.search(index=index_name, body=query)
    values = [bucket["key"] for bucket in response["aggregations"]["affected_entity_values"]["buckets"]]
    return {"entity": entity_key, "values": values}


@router.get("/signals/syslogs/devices/statistics")
def get_device_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_device": {
                "terms": {
                    "field": "device.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [
        {"device": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["by_device"]["buckets"]
    ]

@router.get("/signals/traps/devices/statistics")
def get_device_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_device": {
                "terms": {
                    "field": "device.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [
        {"device": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["by_device"]["buckets"]
    ]

@router.get("/signals/syslogs/mnemonics/statistics")
def get_mnemonic_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_mnemonic": {
                "terms": {
                    "field": "mnemonics.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [
        {"mnemonic": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["by_mnemonic"]["buckets"]
    ]


@router.get("/signals/traps/snmpTrapOid/statistics")
def get_mnemonic_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_mnemonic": {
                "terms": {
                    "field": "snmpTrapOid.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [
        {"snmpTrapOid": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["by_snmpTrapOid"]["buckets"]
    ]

@router.get("/signals/syslogs/rules/statistics")
def get_rule_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_rule": {
                "terms": {
                    "field": "rule.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=query)
    return [
        {"rule": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["by_rule"]["buckets"]
    ]

@router.get("/signals/traps/rules/statistics")
def get_rule_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_rule": {
                "terms": {
                    "field": "rule.keyword",
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="trap-signals", body=query)
    return [
        {"rule": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["by_rule"]["buckets"]
    ]

@router.get("/signals/stats/status/")
async def get_mnemonic_statistics():
    body = {
        "size": 0,
        "aggs": {
            "status": {
                "terms": {
                    "field": "status.keyword", # Analyze each mnemonic in the list
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=body)
    buckets = response["aggregations"]["status"]["buckets"]
    stats = [{"mnemonic": b["key"], "count": b["doc_count"]} for b in buckets]
    return stats

@router.get("/signals/syslogs/affected-entities/statistics/{entity_key}")
def get_affected_entity_statistics(entity_key: str):
    index_name = "syslog-signals"
    field_path = f"affectedEntities.{entity_key}.keyword"

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
        "entity_key": entity_key,
        "values": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_tag_value"]["buckets"]
        ]
    }

@router.get("/signals/traps/affected-entities/statistics/{entity_key}")
def get_affected_entity_statistics(entity_key: str):
    index_name = "trap-signals"
    field_path = f"affectedEntities.{entity_key}.keyword"

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
        "entity_key": entity_key,
        "values": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_tag_value"]["buckets"]
        ]
    }

@router.get("/signals/stats/affected_entities/")
async def get_affected_entities_statistics():
    body = {
        "size": 0,
        "aggs": {
            "affected_entities_keys": {
                "terms": {
                    "field": "affectedEntities.keyword", # To get the keys
                    "size": 100
                },
                "aggs": {
                    "entity_values": {
                        "terms": {
                            "field": "affectedEntities.*.keyword", # Aggregate values under each key
                            "size": 100
                        }
                    }
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=body)
    aggregations = response.get("aggregations", {})
    affected_entities_keys = aggregations.get("affected_entities_keys", {}).get("buckets", [])

    stats = []
    for key_bucket in affected_entities_keys:
        key_name = key_bucket["key"]
        entity_values = key_bucket["entity_values"]["buckets"]
        for value_bucket in entity_values:
            stats.append({
                "entity_type": key_name,
                "entity_value": value_bucket["key"],
                "count": value_bucket["doc_count"]
            })
    return stats

# A slightly different approach to get counts per entity *type*:
@router.get("/signals/stats/affected_entities_by_type/")
async def get_affected_entities_statistics_by_type():
    body = {
        "size": 0,
        "aggs": {
            "affected_entities": {
                "children": {
                    "field": "affectedEntities"
                },
                "aggs": {
                    "entity_type": {
                        "terms": {
                            "field": "affectedEntities.keyword",
                            "size": 100
                        },
                        "aggs": {
                            "entity_value": {
                                "terms": {
                                    "field": "affectedEntities.*.keyword",
                                    "size": 100
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=body)
    # This response structure will be more complex to parse.
    # You might need to adjust the aggregation based on your exact needs.

    # A simpler aggregation to get counts of values for each entity type:
    body_simple = {
        "size": 0,
        "aggs": {
            "affected_entities": {
                "multi_terms": {
                    "fields": ["affectedEntities.keyword", "affectedEntities.*.keyword"],
                    "size": 1000
                }
            }
        }
    }
    response_simple = opensearch_client.search(index="syslog-signals", body=body_simple)
    buckets_simple = response_simple["aggregations"]["affected_entities"]["buckets"]
    stats_simple = [{"entity": b["key"][0], "value": b["key"][1], "count": b["doc_count"]} for b in buckets_simple]
    return stats_simple

@router.get("/signals/stats/affected_entities/{entity_tag}")
async def get_affected_entities_by_tag(entity_tag: str):
    """
    Returns statistics for a specific tag within the affectedEntities field.
    For example: /signals/stats/affected_entities/Interface
    """
    field_name = f"affectedEntities.{entity_tag}.keyword"
    body = {
        "size": 0,
        "aggs": {
            "entity_values": {
                "terms": {
                    "field": field_name,
                    "size": 1000
                }
            }
        }
    }
    response = opensearch_client.search(index="syslog-signals", body=body)
    buckets = response["aggregations"]["entity_values"]["buckets"]
    stats = [{"name": b["key"], "count": b["doc_count"]} for b in buckets]
    return stats

@router.get("/syslogsignals/syslogsignalseverity", response_model=SyslogSignalSeverityBase)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/syslogsignals/syslogsignalseverity", response_model=SyslogSignalSeverityBase)
async def update_settings(updated_settings: SyslogSignalSeverityBase, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SyslogSignalSeverity).where(SyslogSignalSeverity.id == 1))
    settings = result.scalars().first()

    if settings:
        # Update existing settings
        settings.number = updated_settings.number
        settings.severity = updated_settings.severity
        settings.description = updated_settings.description
    else:
        # Create new settings with id=1
        settings = SyslogSignalSeverity(
            id=1,
            number=updated_settings.number,
            severity=updated_settings.severity,
            description=updated_settings.description
        )
        db.add(settings)

    await db.commit()
    await db.refresh(settings)

    # Save to file after updating/creating severity
    await update_mnemonics_list_in_json(db)

    return settings