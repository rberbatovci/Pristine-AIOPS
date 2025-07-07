from .services import update_mnemonics_list_in_json, create_mnemonic_in_file, update_mnemonics_list_in_json, remove_rule_from_mnemonics_json, save_statefulrules_to_file, remove_rule_from_json
from ..db.session import get_db, opensearch_client
from fastapi import APIRouter, Depends, status, HTTPException, Query, Body, Request 
from . import schemas
from . import models
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import select
import json
import os
import subprocess
import signal
import asyncio
import datetime
from .onSyslogReceive import checkMnemonic, checkTimestamp, checkLSN
from datetime import datetime, timedelta
from sqlalchemy.orm import selectinload
from typing import Dict, Any, List, Optional
from opensearchpy import OpenSearch
from elasticsearch import Elasticsearch
import logging
from collections import defaultdict

# Add this line to define the global variable
listener_process = None
es = Elasticsearch("http://localhost:9200")  # Update your ES host
router = APIRouter()
logger = logging.getLogger(__name__)

SHARED_DATA_DIR = "/app/syslogs/rules"
REGEX_JSON_PATH = os.path.join(SHARED_DATA_DIR, "regex_data.json")
MNEMONICS_JSON_PATH = os.path.join(SHARED_DATA_DIR, "mnemonics.json")
os.makedirs(SHARED_DATA_DIR, exist_ok=True)

@router.post("/syslogs/receiver/start/")
async def start_syslog(port: int):
    global listener_process
    if listener_process and listener_process.poll() is None:
        raise HTTPException(status_code=400, detail="Listener is already running")

    try:
        listener_process = subprocess.Popen(["go", "run", "app/listeners/syslogs/syslogs.go", str(port)])
        return {"message": f"Listener started on port {port}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start listener: {e}")

@router.post("/syslogs/receiver/stop/")
async def stop_syslog():
    global listener_process
    if not listener_process or listener_process.poll() is not None:
        raise HTTPException(status_code=400, detail="Listener is not running")

    try:
        os.kill(listener_process.pid, signal.SIGTERM)
        await asyncio.sleep(1)
        if listener_process.poll() is None:
            listener_process.kill()
        listener_process = None
        return {"message": "Listener stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop listener: {e}")

@router.get("/syslogs/receiver/status/")
async def syslog_status():
    global listener_process
    if listener_process and listener_process.poll() is None:
        return {"status": "running"}
    else:
        return {"status": "stopped"}

@router.post("/syslogs/")
async def create_syslog(syslog_data: schemas.SyslogCreate, db: AsyncSession = Depends(get_db)):
    # Query the Device table to get the hostname from the IP address
    device_query = select(models.Device).filter(models.Device.ip_address == syslog_data.device)
    result = await db.execute(device_query)
    device = result.scalar_one_or_none()  # Fetch a single device or None

    # If no device is found, raise a 404 error
    if not device:
        raise HTTPException(status_code=404, detail="Device with the given IP address not found")

    # Now that we have the hostname, create the syslog record
    syslog = models.Syslog(
        message=syslog_data.message,
        device=device.hostname,  # Set the hostname here
    )
    
    db.add(syslog)
    await db.commit()
    await db.refresh(syslog)
    
    # Call your validation functions
    await checkLSN(syslog, db)
    await checkTimestamp(syslog, db)
    await checkMnemonic(syslog, db)
    
    await db.commit()

    return syslog

def search_openSyslogs(query: Dict[str, Any]):
    response = opensearch_client.search(
        INDEX_NAME = "syslogs",
        body=query
    )
    return response['hits']['hits']  # Extract the relevant data from the response

client = OpenSearch([{'host': 'localhost', 'port': 9200}])

def get_time_range(range_str: str) -> Optional[str]:
    now = datetime.utcnow()
    
    if range_str == 'last_1_hour':
        return (now - timedelta(hours=1)).isoformat()
    elif range_str == 'last_4_hours':
        return (now - timedelta(hours=4)).isoformat()
    elif range_str == 'last_8_hours':
        return (now - timedelta(hours=8)).isoformat()
    elif range_str == 'last_12_hours':
        return (now - timedelta(hours=12)).isoformat()
    elif range_str == 'today':
        return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif range_str == 'this_month':
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    else:
        return None

@router.get("/syslogs/")
async def get_syslogs(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(19, ge=1, le=100),
    time_range: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
):
    start = (page - 1) * page_size
    must_clauses = []

    # Handle time filters
    if time_range:
        from_time = get_time_range(time_range)
        if from_time:
            must_clauses.append({
                "range": {
                    "@timestamp": {
                        "gte": from_time,
                        "lte": "now"
                    }
                }
            })
    elif start_time and end_time:
        must_clauses.append({
            "range": {
                "@timestamp": {
                    "gte": start_time.isoformat(),
                    "lte": end_time.isoformat()
                }
            }
        })

    # Extract all query params
    query_params = request.query_params.multi_items()
    fixed_params = {"page", "page_size", "time_range", "start_time", "end_time"}

    # Extract dynamic filters
    dynamic_filters = [(k, v) for k, v in query_params if k not in fixed_params]

    # Group by field
    filter_dict = defaultdict(list)
    for k, v in dynamic_filters:
        filter_dict[k].append(v)

    # Apply filters on `.keyword` fields
    for field, values in filter_dict.items():
        keyword_field = f"{field}.keyword"
        if len(values) == 1:
            must_clauses.append({"term": {keyword_field: values[0]}})
        else:
            must_clauses.append({"terms": {keyword_field: values}})

    # Compose search query
    body = {
        "query": {
            "bool": {
                "must": must_clauses or [{"match_all": {}}]
            }
        },
        "from": start,
        "size": page_size
    }

    # Optional: debug print
    # import pprint; pprint.pprint(body)

    # Perform search
    response = opensearch_client.search(index='syslogs', body=body)
    hits = response['hits']['hits']
    total = response['hits']['total']['value']

    return {
        "results": hits,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.post("/syslogs/bulk")
async def get_multiple_syslogs(syslog_ids: list[str] = Body(..., embed=True)):
    body = {
        "ids": syslog_ids
    }

    response = opensearch_client.mget(index='syslogs', body=body)

    # Extract only found documents
    results = [doc['_source'] for doc in response['docs'] if doc['found']]

    return {
        "results": results,
        "requested_ids": syslog_ids,
        "found_count": len(results),
        "not_found_ids": [doc['_id'] for doc in response['docs'] if not doc['found']]
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
        logger.exception("Error during OpenSearch aggregation")
        raise HTTPException(status_code=500, detail=f"Error getting terms: {str(e)}")

@router.get("/syslogs/tags/unique-values", response_model=List[str])
def get_dynamic_unique_values(field: str = Query(..., description="Field to aggregate")):
    return get_unique_terms(index="syslogs", field=field)

@router.get("/syslogs/tags/statistics/{tag_key}")
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

    response = opensearch_client.search(index="syslogs", body=query)
    stats = [
        {"value": bucket["key"], "count": bucket["doc_count"]}
        for bucket in response["aggregations"]["tag_value_counts"]["buckets"]
    ]
    return {"tag_key": tag_key, "statistics": stats}

@router.get("/syslogs/filter")
def filter_syslogs_by_tag(index: str, field: str = Query(...), value: str = Query(...), size: int = 100):
    try:
        field_keyword = f"{field}.keyword"
        query_body = {
            "query": {
                "term": {
                    field_keyword: {
                        "value": value
                    }
                }
            },
            "size": size
        }

        response = opensearch_client.search(index=index, body=query_body)
        hits = response["hits"]["hits"]
        return [hit["_source"] for hit in hits]

    except Exception as e:
        logger.exception("Error querying OpenSearch for filtered syslogs")
        raise HTTPException(status_code=500, detail=f"Error querying syslogs: {str(e)}")

@router.get("/syslogs/recent/{hours}")
async def get_recent_syslogs(hours: int, db: AsyncSession = Depends(get_db)):
    if hours not in [1, 4, 12]:
        return {"error": "Invalid time range. Only 1, 4, or 12 hours allowed."}
    
    time_threshold = datetime.utcnow() - timedelta(hours=hours)
    
    stmt = select(models.Syslog).where(models.Syslog.timestamp >= time_threshold).order_by(models.Syslog.timestamp.desc())
    result = await db.execute(stmt)
    syslogs = result.scalars().all()
    return syslogs

async def save_regex_to_file(db: AsyncSession):
    try:
        result = await db.execute(select(models.RegEx))
        regexs = result.scalars().all()

        regex_list = []
        for regex in regexs:
            regex_list.append({
                "name": regex.name,
                "pattern": regex.pattern,
                "matchfunction": regex.matchfunction,
                "matchnumber": regex.matchnumber,
                "groupnumber": regex.groupnumber,
                "nomatch": regex.nomatch,
                "tag": regex.tag,
            })

        # Write the regex data to the shared volume
        with open(REGEX_JSON_PATH, "w") as f:
            json.dump(regex_list, f, indent=4)

        print(f"Regex data saved to: {REGEX_JSON_PATH}")

    except Exception as e:
        print(f"Error saving regex data to file: {e}")

async def load_mnemonics_from_file():
    try:
        with open(MNEMONICS_JSON_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {MNEMONICS_JSON_PATH}")
        return []

@router.get("/syslogs/regex/", response_model=list[schemas.RegExBrief])
async def read_regex(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.RegEx).offset(skip).limit(limit))
    regexs = result.scalars().all()
    return regexs

@router.get("/syslogs/regex/{regex_name}", response_model=schemas.RegExResponse)
async def read_regex(regex_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.RegEx).filter(models.RegEx.name == regex_name))
    db_regex = result.scalars().first()
    if not db_regex:
        raise HTTPException(status_code=404, detail="RegEx not found")
    return db_regex

@router.delete("/syslogs/regex/{regex_name}", response_model=dict)
async def delete_regex(regex_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.RegEx).filter(models.RegEx.name == regex_name))
    db_regex = result.scalars().first()
    if not db_regex:
        raise HTTPException(status_code=404, detail="RegEx not found")

    tag_name = db_regex.tag
    await db.delete(db_regex)
    await db.commit()

    response = {"regex_deleted": True, "tag_deleted": False}

    if tag_name:
        result = await db.execute(select(models.RegEx).filter(models.RegEx.tag == tag_name))
        remaining_regexes = result.scalars().all()

        if not remaining_regexes:
            db_tag_result = await db.scalar(select(models.SyslogTag).filter(models.SyslogTag.name == tag_name))
            if db_tag_result:
                await db.delete(db_tag_result)
                await db.commit()
                response["tag_deleted"] = True

    # Save regex data to the file after deleting the regex
    await save_regex_to_file(db)

    return response

@router.post("/syslogs/regex/", response_model=schemas.RegExResponse)
async def create_regex(regex: schemas.RegExCreate, db: AsyncSession = Depends(get_db)):
    # Check if the RegEx name already exists
    db_regex = await db.scalar(select(models.RegEx).where(models.RegEx.name == regex.name))
    if db_regex:
        raise HTTPException(status_code=400, detail="RegEx name already exists")

    db_tag = None
    if regex.tag:
        db_tag_result = await db.scalar(select(models.SyslogTag).where(models.SyslogTag.name == regex.tag))
        if db_tag_result:
            db_tag = db_tag_result
        else:
            db_tag = models.SyslogTag(name=regex.tag)
            db.add(db_tag)
            await db.commit()
            await db.refresh(db_tag)

    db_regex_create = models.RegEx(**regex.dict())
    if db_tag:
        db_regex_create.tag = db_tag.name

    db.add(db_regex_create)
    await db.commit()
    await db.refresh(db_regex_create)

    # Save regex data to the file after creating the regex
    await save_regex_to_file(db)

    return db_regex_create

@router.put("/syslogs/regex/{regex_name}", response_model=schemas.RegExResponse)
async def update_regex(regex_name: str, regex_update: schemas.RegExUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.RegEx).filter(models.RegEx.name == regex_name))
    db_regex = result.scalars().first()
    if not db_regex:
        raise HTTPException(status_code=404, detail="RegEx not found")

    for key, value in regex_update.dict(exclude_unset=True).items():
        if key == "tag":
            if value:
                db_tag_result = await db.scalar(select(models.SyslogTag).where(models.SyslogTag.name == value))
                db_tag = db_tag_result
                if not db_tag:
                    db_tag = models.SyslogTag(name=value)
                    db.add(db_tag)
                    await db.commit()
                    await db.refresh(db_tag)
                setattr(db_regex, key, db_tag.name)
            else:
                setattr(db_regex, key, None)
        else:
            setattr(db_regex, key, value)

    await db.commit()
    await db.refresh(db_regex)

    # Save regex data to the file after updating the regex
    await save_regex_to_file(db)

    return db_regex

@router.get("/syslogs/tags/", response_model=list[schemas.TagSchema])
async def get_tags(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SyslogTag).offset(skip).limit(limit))
    tags = result.scalars().all()
    return tags

@router.get("/syslogs/tags/{tag_name}", response_model=schemas.TagSchema)
async def get_tag_by_name(tag_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SyslogTag).where(models.SyslogTag.name == tag_name))
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

@router.post("/syslogs/tags/", response_model=schemas.TagSchema)
async def create_tag(tag: schemas.TagCreate, db: AsyncSession = Depends(get_db)):
    db_tag = schemas.Tag(name=tag.name, description=tag.description)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag

@router.delete("/syslogs/tags/{tag_name}")
async def delete_tag(tag_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.SyslogTag).where(models.SyslogTag.name == tag_name))
    tag = result.scalar_one_or_none()
    
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    await db.delete(tag)
    await db.commit()
    
    return {"message": f"Tag '{tag_name}' deleted successfully"}

@router.post("/syslogs/mnemonics/", response_model=schemas.MnemonicSyslog)
async def create_mnemonic(mnemonic: schemas.MnemonicCreate, db: AsyncSession = Depends(get_db)):
    # Check if mnemonic exists
    existing = await db.execute(select(models.Mnemonic).filter(models.Mnemonic.name == mnemonic.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Mnemonic already exists")

    # Create new mnemonic
    db_mnemonic = models.Mnemonic(
        name=mnemonic.name,
        level=mnemonic.level,
        severity=mnemonic.severity,
    )
    db.add(db_mnemonic)
    await db.commit()
    await db.refresh(db_mnemonic)

    # Re-fetch with eager loading of related fields to avoid lazy loading
    result = await db.execute(
        select(models.Mnemonic)
        .options(selectinload(models.Mnemonic.rules), selectinload(models.Mnemonic.regexes))
        .filter(models.Mnemonic.id == db_mnemonic.id)
    )
    mnemonic_with_relations = result.scalars().first()

    create_mnemonic_in_file(mnemonic.name, mnemonic.level, mnemonic.severity)

    return mnemonic_with_relations

@router.get("/syslogs/mnemonics/", response_model=list[schemas.MnemonicSyslog])
async def read_mnemonics(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Mnemonic)
        .options(selectinload(models.Mnemonic.regexes))
        .options(selectinload(models.Mnemonic.rules))  # Load the rules relationship
        .offset(skip)
        .limit(limit)
    )
    mnemonics = result.scalars().all()

    return [
        schemas.MnemonicSyslog(  # Use the new schema
            id=mnemonic.id,
            name=mnemonic.name
        )
        for mnemonic in mnemonics
    ]

@router.get("/syslogs/mnemonics/{mnemonic_name}/", response_model=schemas.MnemonicSyslog)
async def read_mnemonic_by_name(mnemonic_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Mnemonic)
        .where(models.Mnemonic.name == mnemonic_name)
        .options(
            selectinload(models.Mnemonic.regexes),
            selectinload(models.Mnemonic.open_rules),
            selectinload(models.Mnemonic.close_rules),
        )
    )
    db_mnemonic = result.scalars().first()

    if not db_mnemonic:
        raise HTTPException(status_code=404, detail="Mnemonic not found")

    # Combine open_rules and close_rules and avoid duplicates
    related_rules = list({rule.id: rule for rule in (db_mnemonic.open_rules + db_mnemonic.close_rules)}.values())

    return schemas.MnemonicSyslog(
        id=db_mnemonic.id,
        name=db_mnemonic.name,
        severity=db_mnemonic.severity,
        regexes=[regex.name for regex in db_mnemonic.regexes],
        rules=[schemas.RuleInfo(id=rule.id, name=rule.name, description=rule.description) for rule in related_rules]
    )


@router.put("/syslogs/update/mnemonics/{mnemonic_name}", response_model=schemas.MnemonicSyslog)
async def update_mnemonic_by_name(mnemonic_name: str, mnemonic_update: schemas.MnemonicSyslog, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Mnemonic)
        .where(models.Mnemonic.name == mnemonic_name)
        .options(selectinload(models.Mnemonic.regexes))
        .options(selectinload(models.Mnemonic.rules)) # Load rules as well
    )
    db_mnemonic = result.scalars().first()

    if db_mnemonic is None:
        raise HTTPException(status_code=404, detail="Mnemonic not found")

    if mnemonic_update.regexes is not None:
        # Fetch the regex objects by their names
        result_regex = await db.execute(select(models.RegEx).where(models.RegEx.name.in_(mnemonic_update.regexes)))
        regexes = result_regex.scalars().all()

        # Update regexes
        await db.refresh(db_mnemonic, attribute_names=['regexes'])
        db_mnemonic.regexes.clear()
        db_mnemonic.regexes.extend(regexes)

    if mnemonic_update.rules is not None:
        # Fetch the rule objects by their names (assuming rule names are unique)
        result_rules = await db.execute(
            select(models.StatefulSyslogRule).where(models.StatefulSyslogRule.name.in_(mnemonic_update.rules))
        )
        rules = result_rules.scalars().all()

        # Update rules
        await db.refresh(db_mnemonic, attribute_names=['rules'])
        db_mnemonic.rules.clear()
        db_mnemonic.rules.extend(rules)

    # Update other scalar attributes, excluding regexes and rules
    update_data = mnemonic_update.dict(exclude={"regexes", "rules"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_mnemonic, key, value)

    await db.commit()
    await db.refresh(db_mnemonic)

    # Save mnemonics data to the file after updating
    await update_mnemonics_list_in_json(db)

    # Create the response object with regex and rule names
    return schemas.MnemonicSyslog(
        id=db_mnemonic.id,
        name=db_mnemonic.name,
        severity=db_mnemonic.severity,
        regexes=[regex.name for regex in db_mnemonic.regexes],
        rules=[rule.name for rule in db_mnemonic.rules],
    )



mnemonic_rules_association = models.mnemonic_rules_association # Assuming this is defined in your models


@router.post("/syslogs/statefulrules/", response_model=schemas.StatefulSyslogRule)
async def create_stateful_rule(rule: schemas.StatefulSyslogRuleBase, db: AsyncSession = Depends(get_db)):
    # Fetch mnemonics
    open_mnemonic = (
        await db.execute(select(models.Mnemonic).where(models.Mnemonic.name == rule.opensignalmnemonic))
    ).scalars().first()
    if not open_mnemonic:
        raise HTTPException(status_code=400, detail=f"Open signal mnemonic '{rule.opensignalmnemonic}' does not exist.")

    close_mnemonic = (
        await db.execute(select(models.Mnemonic).where(models.Mnemonic.name == rule.closesignalmnemonic))
    ).scalars().first()
    if not close_mnemonic:
        raise HTTPException(status_code=400, detail=f"Close signal mnemonic '{rule.closesignalmnemonic}' does not exist.")

    # Fetch devices by hostname
    devices = []
    if rule.device_hostnames:
        result = await db.execute(
            select(models.Device).where(models.Device.hostname.in_(rule.device_hostnames))
        )
        devices = result.scalars().all()

    # Create rule
    db_rule = models.StatefulSyslogRule(
        name=rule.name,
        opensignaltag=rule.opensignaltag,
        opensignalvalue=rule.opensignalvalue,
        closesignaltag=rule.closesignaltag,
        closesignalvalue=rule.closesignalvalue,
        initialseverity=rule.initialseverity,
        affectedentity=rule.affectedentity,
        description=rule.description,
        warmup=rule.warmup,
        cooldown=rule.cooldown,
        opensignalmnemonic=open_mnemonic,
        closesignalmnemonic=close_mnemonic,
        devices=devices,
    )

    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)

    # Eagerly load relationships to avoid MissingGreenlet error
    result = await db.execute(
        select(models.StatefulSyslogRule)
        .options(
            selectinload(models.StatefulSyslogRule.opensignalmnemonic),
            selectinload(models.StatefulSyslogRule.closesignalmnemonic),
            selectinload(models.StatefulSyslogRule.devices),
        )
        .where(models.StatefulSyslogRule.id == db_rule.id)
    )
    db_rule = result.scalars().first()

    # Save JSON updates
    await save_statefulrules_to_file(db)
    await update_mnemonics_list_in_json(db)

    # Manually build the response to match the expected schema
    return {
        "id": db_rule.id,
        "name": db_rule.name,
        "opensignaltag": db_rule.opensignaltag,
        "opensignalvalue": db_rule.opensignalvalue,
        "closesignaltag": db_rule.closesignaltag,
        "closesignalvalue": db_rule.closesignalvalue,
        "initialseverity": db_rule.initialseverity,
        "affectedentity": db_rule.affectedentity,
        "description": db_rule.description,
        "warmup": db_rule.warmup,
        "cooldown": db_rule.cooldown,
        "opensignalmnemonic": db_rule.opensignalmnemonic.name,
        "closesignalmnemonic": db_rule.closesignalmnemonic.name,
        "device_hostnames": [device.hostname for device in db_rule.devices],
    }

@router.get("/syslogs/statefulrules/brief/", response_model=List[schemas.StatefulSyslogRuleBrief])
async def get_stateful_syslog_rules_brief(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.StatefulSyslogRule.id, models.StatefulSyslogRule.name))
    return [{"id": r[0], "name": r[1]} for r in result.all()]

@router.delete("/syslogs/statefulrules/{rule_name}", status_code=204)
async def delete_stateful_syslog_rule(
    rule_name: str, 
    session: AsyncSession = Depends(get_db)
):
    # Eagerly load related mnemonics
    result = await session.execute(
        select(models.StatefulSyslogRule)
        .options(
            selectinload(models.StatefulSyslogRule.opensignalmnemonic),
            selectinload(models.StatefulSyslogRule.closesignalmnemonic)
        )
        .where(models.StatefulSyslogRule.name == rule_name)
    )

    rule = result.scalars().first()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Use the loaded related objects safely
    await remove_rule_from_mnemonics_json(
        rule.name,
        rule.opensignalmnemonic.name,
        rule.closesignalmnemonic.name
    )

    await session.delete(rule)
    await session.commit()

    await remove_rule_from_json(rule.name)

    return {"detail": f"Rule '{rule_name}' deleted successfully"}

@router.put("/syslogs/statefulrules/{rule_name}", response_model=schemas.StatefulSyslogRule)
async def update_stateful_syslog_rule(
    rule_name: str,
    rule: schemas.StatefulSyslogRuleBase,
    db: AsyncSession = Depends(get_db)
):
    # Find the rule by name
    result = await db.execute(
        select(models.StatefulSyslogRule).where(models.StatefulSyslogRule.name == rule_name)
    )
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Stateful Syslog Rule not found")

    # Fetch open mnemonic
    open_mnemonic_result = await db.execute(
        select(models.Mnemonic).where(models.Mnemonic.name == rule.opensignalmnemonic)
    )
    open_mnemonic = open_mnemonic_result.scalars().first()
    if not open_mnemonic:
        raise HTTPException(
            status_code=400,
            detail=f"Open signal mnemonic '{rule.opensignalmnemonic}' does not exist."
        )

    # Fetch close mnemonic
    close_mnemonic_result = await db.execute(
        select(models.Mnemonic).where(models.Mnemonic.name == rule.closesignalmnemonic)
    )
    close_mnemonic = close_mnemonic_result.scalars().first()
    if not close_mnemonic:
        raise HTTPException(
            status_code=400,
            detail=f"Close signal mnemonic '{rule.closesignalmnemonic}' does not exist."
        )

    # Update fields
    db_rule.name = rule.name
    db_rule.opensignalmnemonic = rule.opensignalmnemonic
    db_rule.closesignalmnemonic = rule.closesignalmnemonic
    db_rule.opensignaltag = rule.opensignaltag
    db_rule.opensignalvalue = rule.opensignalvalue
    db_rule.closesignaltag = rule.closesignaltag
    db_rule.closesignalvalue = rule.closesignalvalue
    db_rule.initialseverity = rule.initialseverity
    db_rule.affectedentity = rule.affectedentity
    db_rule.description = rule.description
    db_rule.warmup = rule.warmup
    db_rule.cooldown = rule.cooldown

    # Update device association if provided
    if rule.device_hostnames:
        db_rule.devices = [
            await db.get(models.Device, hostname) for hostname in rule.device_hostnames
        ]
    else:
        db_rule.devices = []

    # Update mnemonic associations
    db_rule.mnemonics = [open_mnemonic, close_mnemonic]

    # Save to database
    await db.commit()
    await db.refresh(db_rule)

    # Save updated rules to JSON file for Kafka usage
    await save_statefulrules_to_file(db)

    return db_rule

@router.get("/syslogs/statefulrules/{rule_name}", response_model=schemas.StatefulSyslogRuleBase)
async def get_rule(rule_name: str, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(models.StatefulSyslogRule)
        .options(
            selectinload(models.StatefulSyslogRule.opensignalmnemonic),
            selectinload(models.StatefulSyslogRule.closesignalmnemonic),
            selectinload(models.StatefulSyslogRule.devices),
        )
        .where(models.StatefulSyslogRule.name == rule_name)
    )
    result = await db.execute(stmt)
    db_rule = result.scalars().first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    return schemas.StatefulSyslogRuleBase(
        name=db_rule.name,
        opensignalmnemonic=db_rule.opensignalmnemonic.name if db_rule.opensignalmnemonic else None,
        closesignalmnemonic=db_rule.closesignalmnemonic.name if db_rule.closesignalmnemonic else None,
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