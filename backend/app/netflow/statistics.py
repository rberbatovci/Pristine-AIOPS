from fastapi import APIRouter, Depends, HTTPException, Query, Body 
from typing import List
from app.db.session import opensearch_client
from app.auth.keycloak import get_current_user, require_admin

router = APIRouter(
    prefix="/api/netflow/statistics",
    tags=["netflow,statistics"],
)

@router.get("/{key}")
def get_field_statistics(key: str, user: dict = Depends(get_current_user)):

    query = {
        "size": 0,
        "aggs": {
            "value_counts": {
                "terms": {
                    "field": key,
                    "size": 20   # 👈 top 20 only
                }
            }
        }
    }

    response = opensearch_client.search(index="netflow", body=query)

    buckets = (
        response.get("aggregations", {})
        .get("value_counts", {})
        .get("buckets", [])
    )

    stats = [
        {"value": b["key"], "count": b["doc_count"]}
        for b in buckets
    ]

    return {"key": key, "statistics": stats} 

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

@router.get("/netflow/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate")):
    field_path = field

    try:
        return get_unique_terms(index="netflow", field=field_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))