from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any, List
from app.db.session import get_db, opensearch_client
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/telemetry",
    tags=["telemetry"],
)

@router.get("/cpu-utilization/")
def get_cpu_utilization(
    device: Optional[str] = Query(None),
    limit: int = Query(100),
    user: dict = Depends(get_current_user)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device": device}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"timestamp": {"order": "desc"}}
        ]
    }

    try:
        res = opensearch_client.search(index="cpu-utilization", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    results = [hit["_source"] for hit in res["hits"]["hits"]]
    return {"results": results}

@router.get("/memory-statistics/")
def get_memory_statistics(
    device: Optional[str] = Query(None),
    memory: Optional[str] = Query(None),
    limit: int = Query(100),
    user: dict = Depends(get_current_user)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device": device}})
    if memory:
        must_clauses.append({"term": {"memory": memory}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"timestamp": {"order": "desc"}}
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
            "timestamp": doc["_source"]["timestamp"],
            "ingested_at": doc["_source"]["ingested_at"], 
        }
        for doc in hits
    ]

    return {"results": results}

@router.get("/interface-statistics/interfaces/")
def get_device_interfaces(device: Optional[str] = Query(None), user: dict = Depends(get_current_user)):
    must_clauses = []
    if device:
        must_clauses.append({"term": {"device": device}})

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
                    "field": "interface",
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

@router.get("/interface-statistics/")
def get_interface_statistics(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    limit: int = Query(100),
    user: dict = Depends(get_current_user)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device": device}})
    if interface:
        must_clauses.append({"term": {"interface": interface}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"timestamp": {"order": "desc"}}
        ]
    }

    try:
        response = opensearch_client.search(index="interface-statistics", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    hits = response.get("hits", {}).get("hits", [])

    results = [
        {
            "device": doc["_source"]["device"],
            "interface": doc["_source"]["interface"],
            "stats": doc["_source"]["stats"],
            "timestamp": doc["_source"]["timestamp"],
            "ingested_at": doc["_source"]["ingested_at"], 
            "subscription": doc["_source"].get("subscription", {}),
        }
        for doc in hits
    ]

    return {"results": results}

@router.get("/interface-oper-status/")
def get_interface_oper_status(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    limit: int = Query(100),
    user: dict = Depends(get_current_user)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device": device}})
    if interface:
        must_clauses.append({"term": {"interface": interface}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"timestamp": {"order": "desc"}}
        ]
    }

    try:
        response = opensearch_client.search(index="interface-oper-status", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    hits = response["hits"]["hits"]

    results = [
        {
            "device": doc["_source"]["device"],
            "interface": doc["_source"]["interface"],
            "status": doc["_source"]["status"],
            "timestamp": doc["_source"]["timestamp"],
            "ingested_at": doc["_source"]["ingested_at"], 
        }
        for doc in hits
    ]

    return {"results": results}
 
@router.get("/interface-oper-status/interfaces/")
def get_device_interfaces(device: Optional[str] = Query(None), user: dict = Depends(get_current_user)):
    must_clauses = []
    if device:
        # Use the `.keyword` field to aggregate exact matches
        must_clauses.append({"term": {"device": device}})

    query = {
        "size": 0,  # We only want aggregation results
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "aggs": {
            "unique_interfaces": {
                "terms": {
                    "field": "interface",
                    "size": 1000  # max number of interfaces to return
                }
            }
        }
    }

    try:
        response = opensearch_client.search(index="interface-oper-status", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    buckets = response.get("aggregations", {}).get("unique_interfaces", {}).get("buckets", [])
    interfaces = [bucket["key"] for bucket in buckets]

    return {"interfaces": interfaces}

@router.get("/bgp-statistics/")
def get_interface_statistics(
    device: Optional[str] = Query(None),
    interface: Optional[str] = Query(None),
    limit: int = Query(100),
    user: dict = Depends(get_current_user)
):
    must_clauses = []

    if device:
        must_clauses.append({"term": {"device": device}})
    if interface:
        must_clauses.append({"term": {"neighbor": interface}})

    query = {
        "query": {
            "bool": {
                "must": must_clauses
            }
        },
        "size": limit,
        "sort": [
            {"timestamp": {"order": "desc"}}
        ]
    }

    try:
        response = opensearch_client.search(index="bgp-connections", body=query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenSearch query failed: {str(e)}")

    hits = response.get("hits", {}).get("hits", [])

    results = [
        {
            "device": doc["_source"]["device"],
            "neighbor": doc["_source"]["neighbor"],
            "stats": doc["_source"]["stats"],
            "timestamp": doc["_source"]["timestamp"],
            "ingested_at": doc["_source"]["ingested_at"], 
            "subscription": doc["_source"].get("subscription", {}),
        }
        for doc in hits
    ]

    return {"results": results}