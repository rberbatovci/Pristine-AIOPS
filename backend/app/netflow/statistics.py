from fastapi import APIRouter, HTTPException, Query, Body 
from typing import List
from app.db.session import opensearch_client

router = APIRouter()

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