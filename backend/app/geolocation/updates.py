from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app.db.session import opensearch_client


router = APIRouter(
    prefix="/api/topology/updates",
    tags=["Topology", "Updates"],
)


OPENSEARCH_INDEX = "bgp-topology-events"


@router.get("/events")
async def get_topology_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),

    nlri_type: Optional[str] = None,
    event_type: Optional[str] = None,
    is_withdraw: Optional[bool] = None,
    source_id: Optional[str] = None,

    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
):
    """
    Return raw BGP-LS events stored in OpenSearch.

    Each Kafka event corresponds to one OpenSearch document.
    """

    try:
        filters = []

        # ----------------------------------------
        # Exact filters
        # ----------------------------------------

        if nlri_type:
            filters.append({
                "term": {
                    "nlri_type.keyword": nlri_type
                }
            })

        if event_type:
            filters.append({
                "term": {
                    "event_type.keyword": event_type
                }
            })

        if is_withdraw is not None:
            filters.append({
                "term": {
                    "is_withdraw": is_withdraw
                }
            })

        if source_id:
            filters.append({
                "term": {
                    "path.sourceId.keyword": source_id
                }
            })

        # ----------------------------------------
        # Timestamp filter
        # ----------------------------------------

        if start_time or end_time:

            timestamp_range = {}

            if start_time:
                timestamp_range["gte"] = start_time.isoformat()

            if end_time:
                timestamp_range["lte"] = end_time.isoformat()

            filters.append({
                "range": {
                    "timestamp": timestamp_range
                }
            })

        # ----------------------------------------
        # Query
        # ----------------------------------------

        if filters:
            query = {
                "bool": {
                    "filter": filters
                }
            }
        else:
            query = {
                "match_all": {}
            }

        # ----------------------------------------
        # Pagination
        # ----------------------------------------

        from_value = (page - 1) * page_size

        body = {
            "from": from_value,
            "size": page_size,

            "query": query,

            "sort": [
                {
                    "timestamp": {
                        "order": "desc"
                    }
                }
            ]
        }

        # ----------------------------------------
        # OpenSearch
        # ----------------------------------------

        response = opensearch_client.search(
            index=OPENSEARCH_INDEX,
            body=body,
        )

        # ----------------------------------------
        # Hits
        # ----------------------------------------

        hits = response["hits"]["hits"]

        total = response["hits"]["total"]

        if isinstance(total, dict):
            total = total["value"]

        # ----------------------------------------
        # Events
        # ----------------------------------------

        events = []

        for hit in hits:

            events.append({
                "id": hit["_id"],
                **hit["_source"],
            })

        # ----------------------------------------
        # Pagination metadata
        # ----------------------------------------

        total_pages = (
            (total + page_size - 1) // page_size
            if total > 0
            else 0
        )

        # ----------------------------------------
        # Response
        # ----------------------------------------

        return {
            "data": events,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": total_pages,
            },
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve topology events: {str(e)}",
        )