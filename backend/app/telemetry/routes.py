from fastapi import APIRouter, HTTPException
from typing import Optional, Dict, Any, List
from ..db.session import get_db, opensearch_client

router = APIRouter()

@router.get("/telemetry/interface-statistics/", response_model=List[Dict[str, Any]])
async def getInterfaceStatistics(
    device_id: str,
    interface_name: str,
    size: int = 10,  # Number of documents to fetch (default 10)
    from_: int = 0  # Starting offset for pagination
):
    """
    Fetches telemetry data from the OpenSearch database based on device ID and interface name.

    Args:
        device_id (str): The ID of the network device (e.g., "CSR1kvRouter3").
        interface_name (str): The name of the interface (e.g., "Loopback0").
        size (int): The number of documents to return.
        from_ (int): The starting offset for the results (for pagination).

    Returns:
        List[Dict[str, Any]]: A list of telemetry data documents matching the criteria.
    """
    if opensearch_client is None:
        raise HTTPException(status_code=500, detail="OpenSearch connection not established.")

    search_body: Dict[str, Any] = {
        "size": size,
        "from": from_,
        "_source": True, 
        "query": {
            "bool": {
                "must": [
                    {
                        "term": {
                            "node_id.NodeIdStr.keyword": device_id
                        }
                    },
                    {
                        "term": {
                            "stats.keys.name.keyword": interface_name 
                        }
                    }
                ]
            }
        }
    }

    try:
        response = opensearch_client.search(
            index="telemetry-data",
            body=search_body
        )
        hits = response.get('hits', {}).get('hits', [])
        # Extract just the _source part of each hit
        telemetry_documents = [hit.get('_source') for hit in hits if hit.get('_source')]
        return telemetry_documents
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"OpenSearch connection error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching data from OpenSearch: {e}")
