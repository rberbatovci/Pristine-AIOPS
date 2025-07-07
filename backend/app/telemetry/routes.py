from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any, List
from ..db.session import get_db, opensearch_client

router = APIRouter()

@router.get("/telemetry/cpu-utilization/")
def get_cpu_utilization(
    device: Optional[str] = Query(None),
    limit: int = Query(100)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device.keyword": device}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"msg_timestamp": {"order": "desc"}}
        ]
    }

    try:
        res = opensearch_client.search(index="cpu-utilization", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    results = [hit["_source"] for hit in res["hits"]["hits"]]
    return {"results": results}

@router.get("/telemetry/memory-statistics/")
def get_memory_statistics(
    device: Optional[str] = Query(None),
    memory: Optional[str] = Query(None),
    limit: int = Query(100)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device.keyword": device}})
    if memory:
        must_clauses.append({"term": {"memory.keyword": memory}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"msg_timestamp": {"order": "desc"}}
        ]
    }

    try:
        response = opensearch_client.search(index="memory-statistics", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    hits = response["hits"]["hits"]

    results = [
        {
            "device": doc["_source"]["device"],
            "memory": doc["_source"]["memory"],
            "stats": doc["_source"]["stats"],
            "timestamp": doc["_source"]["msg_timestamp"],
            "ingested_at": doc["_source"]["ingested_at"],
            "collection_id": doc["_source"]["collection_id"],
        }
        for doc in hits
    ]

    return {"results": results}

@router.get("/telemetry/interface-statistics/interfaces/")
def getDeviceInterfaces(device: Optional[str] = Query(None)):
    must_clauses = []
    if device:
        must_clauses.append({"term": {"device.keyword": device}})

    query = {
        "size": 0,
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "aggs": {
            "unique_interfaces": {
                "terms": {
                    "field": "interface.keyword",
                    "size": 1000
                }
            }
        }
    }

    try:
        response = opensearch_client.search(index="interface-statistics", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    buckets = response.get("aggregations", {}).get("unique_interfaces", {}).get("buckets", [])
    interfaces = [bucket["key"] for bucket in buckets]

    return {"interfaces": interfaces}

@router.get("/telemetry/interface-statistics/")
def get_memory_statistics(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    limit: int = Query(100)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device.keyword": device}})
    if interface:
        must_clauses.append({"term": {"interface.keyword": interface}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"msg_timestamp": {"order": "desc"}}
        ]
    }

    try:
        response = opensearch_client.search(index="interface-statistics", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    hits = response["hits"]["hits"]

    results = [
        {
            "device": doc["_source"]["device"],
            "interface": doc["_source"]["interface"],
            "stats": doc["_source"]["stats"],
            "timestamp": doc["_source"]["msg_timestamp"],
            "ingested_at": doc["_source"]["ingested_at"],
            "collection_id": doc["_source"]["collection_id"],
        }
        for doc in hits
    ]

    return {"results": results}