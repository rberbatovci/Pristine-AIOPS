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
async def get_all_syslog_signals():
    body = {
        "query": {"match_all": {}},
        "size": 10000  # Max number allowed by OpenSearch (default is 10,000)
    }
    response = opensearch_client.search(
        index='syslog-signals',
        body=body
    )

    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total
    }

@router.get("/signals/trapsignals/")
async def get_all_trap_signals():
    body = {
        "query": {"match_all": {}},
        "size": 10000  # Max number allowed by OpenSearch (default is 10,000)
    }
    response = opensearch_client.search(
        index='trap-signals',
        body=body
    )

    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total
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
    return {
        "tag_key": "device",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_device"]["buckets"]
        ]
    }

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
                    "field": "mnemonics.keyword",
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

@router.get("/signals/traps/snmpTrapOid/statistics")
def get_snmp_oid_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_snmpTrapOid": {
                "terms": {
                    "field": "snmpTrapOid.keyword",
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
    return {
        "tag_key": "rule",
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_rule"]["buckets"]
        ]
    }

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
                    "field": "status.keyword",
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

@router.get("/signals/traps/status/statistics")
def get_trap_status_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_status": {
                "terms": {
                    "field": "status.keyword",
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
                    "field": "severity.keyword",
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

@router.get("/signals/syslogs/severity/statistics")
def get_trap_severity_statistics():
    query = {
        "size": 0,
        "aggs": {
            "by_severity": {
                "terms": {
                    "field": "severity.keyword",
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
        "tag_key": entity_key,
        "statistics": [
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
        "tag_key": entity_key,
        "statistics": [
            {"value": bucket["key"], "count": bucket["doc_count"]}
            for bucket in response["aggregations"]["by_tag_value"]["buckets"]
        ]
    }


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