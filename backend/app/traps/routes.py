from .schemas import Trap, TrapCreate, TrapOidCreate, TagBrief, StatefulTrapRuleResponse, SNMPConfig, TagSchema, TrapOid, StatefulTrapRuleBase, TagCreate, TagUpdate, StatefulTrapRule, TagDelete, TrapOidBrief, TrapOidUpdate, StatefulTrapRuleBrief
from .services import add_tag_to_redis, delete_tag_from_redis, update_tag_in_redis, sync_snmp_trap_oids_to_redis, sync_tags_to_redis, remove_rule_from_snmpTrapOid, checkOids, update_trap_rules_in_json, update_snmpTrapOid_tags_in_file, save_tags_to_json_file, update_tag_in_json_file, delete_tag_from_json_file, save_statefulrules_to_file, remove_rule_from_json
from app.devices.models import Device as DeviceModel
from .models import Tag as TagModel
from .models import Trap as TrapModel
from .models import TrapOid as TrapOidModel, StatefulTrapRule as TrapRulesModel
from ..db.session import get_db, opensearch_client
from fastapi import APIRouter, Depends, status, HTTPException, Query, UploadFile, File, Body, Request
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
import redis
from datetime import datetime
from collections import defaultdict

router = APIRouter()

MIBS_DIR = "/app/traps/producer/mibs"







async def get_trapOid_by_name(db: AsyncSession, trap_oid_name: str) -> TrapOidModel | None:
    result = await db.execute(select(TrapOidModel).where(TrapOidModel.name == trap_oid_name))
    return result.scalar_one_or_none()
