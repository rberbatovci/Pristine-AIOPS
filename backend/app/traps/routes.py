from .schemas import Trap, TrapCreate, TrapOidCreate, TagBrief, StatefulTrapRuleResponse, SNMPConfig, TagSchema, TrapOid, StatefulTrapRuleBase, TagCreate, TagUpdate, StatefulTrapRule, TagDelete, TrapOidBrief, TrapOidUpdate, StatefulTrapRuleBrief
from .services import remove_rule_from_snmpTrapOid, checkOids, update_trap_rules_in_json, update_snmpTrapOid_tags_in_file, save_tags_to_json_file, update_tag_in_json_file, delete_tag_from_json_file, save_statefulrules_to_file, remove_rule_from_json
from app.devices.models import Device as DeviceModel
from .models import Tag as TagModel
from .models import Trap as TrapModel
from .models import TrapOid as TrapOidModel, StatefulTrapRule as TrapRulesModel
from ..db.session import get_db, opensearch_client
from fastapi import APIRouter, Depends, status, HTTPException, Query, UploadFile, File, Body
from fastapi.responses import JSONResponse
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from sqlalchemy import select, insert, delete, update
from opensearchpy import OpenSearch
import shutil
from .services import create_snmpTrapOid_in_file
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import selectinload
import traceback

router = APIRouter()

MIBS_DIR = "/app/traps/mibs"

@router.get("/traps/mibs/")
def list_mibs():
    try:
        files = [f for f in os.listdir(MIBS_DIR) if os.path.isfile(os.path.join(MIBS_DIR, f))]
        return JSONResponse(content={"mibs": files})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.delete("/traps/mibs/{filename}")
def delete_mib(filename: str):
    file_path = os.path.join(MIBS_DIR, filename)
    try:
        if os.path.exists(file_path) and os.path.isfile(file_path):
            os.remove(file_path)
            return JSONResponse(content={"message": f"{filename} deleted."})
        return JSONResponse(status_code=404, content={"error": "File not found."})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@router.post("/traps/mibs/upload/")
async def upload_mib(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(MIBS_DIR, file.filename)

        # Save uploaded file to the MIBS_DIR
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return JSONResponse(content={"filename": file.filename, "message": "File uploaded successfully."})

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@router.post("/traps/")
async def create_trap(trap_data: TrapCreate, db: AsyncSession = Depends(get_db)):
    trap = TrapModel(
        content=trap_data.content,
        device=trap_data.device
    )
    db.add(trap)
    await db.commit()
    await db.refresh(trap)
    await checkOids(trap, db)
    await db.commit()

client = OpenSearch([{'host': 'localhost', 'port': 9200}])

@router.get("/traps/")
async def get_traps(page: int = Query(1, ge=1, description="Page number"),
                    page_size: int = Query(10, ge=1, le=100, description="Number of items per page")):
    """
    Retrieves paginated SNMP traps from OpenSearch.

    Args:
        page: The page number to retrieve (default: 1).
        page_size: The number of traps to return per page (default: 10, max: 100).

    Returns:
        A list of trap hits for the requested page.
    """
    start = (page - 1) * page_size
    body = {
        "query": {"match_all": {}},
        "from": start,
        "size": page_size
    }
    response = opensearch_client.search(
        index="traps",
        body=body
    )
    
    hits = response['hits']['hits']
    total = response['hits']['total']['value']  # Get total number of traps

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.post("/traps/bulk")
async def get_multiple_traps(trap_ids: list[str] = Body(..., embed=True)):
    query = {
        "query": {
            "terms": {
                "trap_id.keyword": trap_ids
            }
        },
        "size": len(trap_ids)  # adjust if expecting many results
    }

    response = opensearch_client.search(index="traps", body=query)
    results = [hit["_source"] for hit in response["hits"]["hits"]]

    return {
        "results": results,
        "requested_ids": trap_ids,
        "found_count": len(results),
        "not_found_ids": list(set(trap_ids) - {doc["trap_id"] for doc in results})
    }

def get_unique_terms(index: str, field: str, size: int = 1000) -> List[str]:
    try:
        field_keyword = f"{field}.keyword"
        response = opensearch_client.search(
            index=index,
            size=0,
            body={
                "aggs": {
                    "unique_terms": {
                        "terms": {
                            "field": field_keyword,
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
    return get_unique_terms(index="traps", field=field)

@router.get("/traps/tags/statistics/{tag_key}")
def get_tag_statistics(tag_key: str):
    query = {
        "size": 0,
        "aggs": {
            "tag_value_counts": {
                "terms": {
                    "field": f"{tag_key}.keyword",
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

@router.get("/traps/tags/", response_model=list[TagBrief])
async def get_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TagModel).offset(skip).limit(limit))
    tags = result.scalars().all()
    return tags

@router.get("/traps/tags/{name}", response_model=TagSchema)
async def get_tag_by_name(name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TagModel).where(TagModel.name == name))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

@router.post("/traps/tags/", response_model=TagSchema, status_code=201)
async def create_tag(tag: TagCreate, db: AsyncSession = Depends(get_db)):
    try:
        async with db.begin():
            stmt = (
                insert(TagModel)
                .values(name=tag.name, oids=tag.oids)
                .returning(TagModel.name, TagModel.oids)
            )
            result = await db.execute(stmt)
            name, oids = result.one()

        # ✅ Save only after DB commit
        save_tags_to_json_file({"name": name, "oids": oids})

        return TagSchema(name=name, oids=oids)

    except Exception:
        await db.rollback()
        existing = await db.execute(
            select(TagModel).where(TagModel.name == tag.name)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Tag with this name already exists")

        raise HTTPException(status_code=500, detail="Failed to create tag due to server error.")


@router.put("/traps/tags/{name}", response_model=TagSchema)
async def update_tag(name: str, tag: TagUpdate, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        stmt = (
            update(TagModel)
            .where(TagModel.name == name)
            .values(oids=tag.oids)
        )
        await db.execute(stmt)

    result = await db.execute(select(TagModel).where(TagModel.name == name))
    updated = result.scalar_one_or_none()

    if not updated:
        raise HTTPException(404, "Tag not found")

    update_tag_in_json_file(name, tag.oids)
    return TagSchema.from_orm(updated)

@router.delete("/traps/tags/{name}", status_code=204)
async def delete_tag(name: str, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        stmt = delete(TagModel).where(TagModel.name == name)
        result = await db.execute(stmt)
        if result.rowcount == 0:
            raise HTTPException(404, "Tag not found")

        # delete from JSON
        delete_tag_from_json_file(name)


@router.delete("/traps/tags/{tag_name}", status_code=204)
async def delete_tag(tag_name: str, db: AsyncSession = Depends(get_db)):
    async with db.begin():
        stmt = delete(TagModel).where(TagModel.name == tag_name)
        result = await db.execute(stmt)
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Tag '{tag_name}' not found")
    return

@router.post("/traps/trapOids/", response_model=TrapOidCreate)
async def create_snmpTrapOid(snmpTrapOid: TrapOidCreate, db: AsyncSession = Depends(get_db)):
    # Check if mnemonic exists
    existing = await db.execute(select(TrapOidModel).filter(TrapOidModel.name == snmpTrapOid.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="SNMP Trap OID already exists")

    # Create new mnemonic
    db_snmpTrapOid = TrapOidModel(
        name=snmpTrapOid.name,
        value=snmpTrapOid.name,
    )
    db.add(db_snmpTrapOid)
    await db.commit()
    await db.refresh(db_snmpTrapOid)

    # Re-fetch with eager loading of related fields to avoid lazy loading
    result = await db.execute(
        select(TrapOidModel)
        .options(selectinload(TrapOidModel.rules))
        .filter(TrapOidModel.id == db_snmpTrapOid.id)
    )
    snmpTrapOid_with_relations = result.scalars().first()

    create_snmpTrapOid_in_file(snmpTrapOid.name)

    return snmpTrapOid_with_relations

@router.get("/traps/trapOids/", response_model=list[TrapOidBrief])
async def read_mnemonics(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrapOidModel).offset(skip).limit(limit))
    mnemonics = result.scalars().all()
    return mnemonics

@router.get("/traps/trapOids/{trap_oid_name}", response_model=TrapOid)
async def get_trap_oid_by_name(trap_oid_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrapOidModel).options(selectinload(TrapOidModel.rules)).where(TrapOidModel.name == trap_oid_name)
    )
    trap_oid = result.scalars().first()
    if not trap_oid:
        raise HTTPException(status_code=404, detail="TrapOid not found")
    return trap_oid

@router.patch("/traps/trapOids/{trap_oid_name}", response_model=TrapOid)
async def update_trap_oid_by_name(
    trap_oid_name: str,
    trap_oid_update: TrapOidUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TrapOidModel)
        .options(selectinload(TrapOidModel.rules))
        .filter(TrapOidModel.name == trap_oid_name)
    )
    trap_oid = result.scalars().first()
    if not trap_oid:
        raise HTTPException(status_code=404, detail="TrapOid not found")

    if trap_oid_update.tags is not None:
        trap_oid.tags = trap_oid_update.tags

    db.add(trap_oid)
    await db.commit()
    await db.refresh(trap_oid)

    # ✅ Update JSON file
    if trap_oid_update.tags is not None:
        try:
            update_snmpTrapOid_tags_in_file(trap_oid_name, trap_oid_update.tags)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update JSON file: {str(e)}")

    return trap_oid

async def get_trapOid_by_name(db: AsyncSession, trap_oid_name: str) -> TrapOidModel | None:
    result = await db.execute(select(TrapOidModel).where(TrapOidModel.name == trap_oid_name))
    return result.scalar_one_or_none()

@router.get("/traps/statefulrules/", response_model=List[StatefulTrapRuleBrief])
async def get_stateful_trap_rules_brief(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrapRulesModel.id, TrapRulesModel.name))
    return [{"id": r[0], "name": r[1]} for r in result.all()]

@router.post("/traps/statefulrules/", response_model=StatefulTrapRuleResponse)
async def create_stateful_rule(rule: StatefulTrapRuleBase, db: AsyncSession = Depends(get_db)):
    try:
        # Fetch trap OIDs
        open_trapOid = (
            await db.execute(select(TrapOidModel).where(TrapOidModel.name == rule.opensignaltrap))
        ).scalars().first()
        if rule.opensignaltrap and not open_trapOid:
            raise HTTPException(status_code=400, detail=f"Open signal Trap '{rule.opensignaltrap}' does not exist.")

        close_trapOid = (
            await db.execute(select(TrapOidModel).where(TrapOidModel.name == rule.closesignaltrap))
        ).scalars().first()
        if rule.closesignaltrap and not close_trapOid:
            raise HTTPException(status_code=400, detail=f"Close signal Trap '{rule.closesignaltrap}' does not exist.")

        # Fetch devices by hostname
        devices = []
        if rule.device_hostnames:
            result = await db.execute(
                select(DeviceModel).where(DeviceModel.hostname.in_(rule.device_hostnames))
            )
            devices = result.scalars().all()

        # Create rule
        db_rule = TrapRulesModel(
            name = rule.name,
            opensignaltag = rule.opensignaltag,
            opensignalvalue = rule.opensignalvalue,
            closesignaltag = rule.closesignaltag,
            closesignalvalue = rule.closesignalvalue,
            initialseverity = rule.initialseverity,
            affectedentity = rule.affectedentity,
            description = rule.description,
            warmup = rule.warmup,
            cooldown = rule.cooldown,
            opensignaltrap = open_trapOid,
            closesignaltrap = close_trapOid,
            devices = devices
        )

        db.add(db_rule)
        await db.commit()
        await db.refresh(db_rule)

        result = await db.execute(
            select(TrapRulesModel)
            .options(
                selectinload(TrapRulesModel.opensignaltrap),
                selectinload(TrapRulesModel.closesignaltrap),
                selectinload(TrapRulesModel.devices),
            )
            .where(TrapRulesModel.id == db_rule.id)
        )
        db_rule = result.scalars().first()

        await save_statefulrules_to_file(db)
        await update_trap_rules_in_json(
            opensignaltrap_name=db_rule.opensignaltrap.name,
            closesignaltrap_name=db_rule.closesignaltrap.name,
            rule_name=db_rule.name
        )

        return StatefulTrapRuleResponse(
            id=db_rule.id,
            name=db_rule.name,
            opensignaltag=db_rule.opensignaltag,
            opensignalvalue=db_rule.opensignalvalue,
            closesignaltag=db_rule.closesignaltag,
            closesignalvalue=db_rule.closesignalvalue,
            initialseverity=db_rule.initialseverity,
            affectedentity=db_rule.affectedentity,
            description=db_rule.description,
            warmup=db_rule.warmup,
            cooldown=db_rule.cooldown,
            opensignaltrap=db_rule.opensignaltrap.name,
            closesignaltrap=db_rule.closesignaltrap.name,
            device_hostnames=[device.hostname for device in db_rule.devices],
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/traps/statefulrules/{rule_name}", response_model=StatefulTrapRuleBase)
async def get_rule(rule_name: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(TrapRulesModel)
        .options(
            selectinload(TrapRulesModel.opensignaltrap),
            selectinload(TrapRulesModel.closesignaltrap),
            selectinload(TrapRulesModel.devices),
        )
        .where(TrapRulesModel.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return StatefulTrapRuleBase(
        name=db_rule.name,
        opensignaltrap=db_rule.opensignaltrap.name if db_rule.opensignaltrap else None,
        closesignaltrap=db_rule.closesignaltrap.name if db_rule.closesignaltrap else None,
        opensignaltag=db_rule.opensignaltag,
        opensignalvalue=db_rule.opensignalvalue,
        closesignaltag=db_rule.closesignaltag,
        closesignalvalue=db_rule.closesignalvalue,
        initialseverity=db_rule.initialseverity,
        affectedentity=db_rule.affectedentity,
        description=db_rule.description,
        warmup=db_rule.warmup,
        cooldown=db_rule.cooldown,
        device_hostnames=[device.hostname for device in db_rule.devices] if db_rule.devices else [],
    )

@router.delete("/traps/statefulrules/{rule_name}", status_code=204)
async def delete_stateful_syslog_rule(
    rule_name: str, 
    session: AsyncSession = Depends(get_db)
):
    # Eagerly load related mnemonics
    result = await session.execute(
        select(TrapRulesModel)
        .options(
            selectinload(TrapRulesModel.opensignaltrap),
            selectinload(TrapRulesModel.closesignaltrap)
        )
        .where(TrapRulesModel.name == rule_name)
    )

    rule = result.scalars().first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await session.delete(rule)
    await session.commit()

    await remove_rule_from_json(rule.name)
    await remove_rule_from_snmpTrapOid(rule.name)

    return {"detail": f"Rule '{rule_name}' deleted successfully"}
