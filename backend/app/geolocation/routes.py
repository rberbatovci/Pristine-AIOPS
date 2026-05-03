from fastapi import APIRouter, Depends
import grpc
from grpc import RpcError
from google.protobuf.json_format import MessageToDict

from . import gobgp_pb2, gobgp_pb2_grpc, attribute_pb2
from app.auth.keycloak import get_current_user

router = APIRouter(
    prefix="/api/topology",
    tags=["topology", "data"],
)

# -----------------------------
# Protobuf Mapping
# -----------------------------
CLASS_MAP = {
    "LsAddrPrefix": attribute_pb2.LsAddrPrefix,
    "LsAttribute": attribute_pb2.LsAttribute,
    "MpReachNLRIAttribute": attribute_pb2.MpReachNLRIAttribute,
    "OriginAttribute": attribute_pb2.OriginAttribute,
    "AsPathAttribute": attribute_pb2.AsPathAttribute,
    "MultiExitDiscAttribute": attribute_pb2.MultiExitDiscAttribute,
    "LocalPrefAttribute": attribute_pb2.LocalPrefAttribute,
}

# -----------------------------
# Helpers
# -----------------------------
def unpack_any(any_msg):
    type_url = any_msg.type_url
    short_name = type_url.split(".")[-1]

    if short_name in CLASS_MAP:
        msg_cls = CLASS_MAP[short_name]
        msg = msg_cls()
        msg.ParseFromString(any_msg.value)
        return short_name, MessageToDict(msg)

    return short_name, {}


def classify_entry(nlri_dict):
    nlri_type = nlri_dict.get("type")

    if nlri_type in ["LS_NLRI_PREFIX_V4", "LS_NLRI_PREFIX_V6"]:
        return "prefix"

    if nlri_type == "LS_NLRI_NODE":
        return "node"

    if nlri_type == "LS_NLRI_LINK":
        return "link"

    return None


# -----------------------------
# Normalizers
# -----------------------------
def parse_node(nlri):
    node = nlri["nlri"]["localNode"]

    return {
        "asn": node.get("asn"),
        "router_id": node.get("igpRouterId"),
        "pseudonode": node.get("pseudonode", False),
    }


def parse_link(nlri):
    data = nlri["nlri"]

    return {
        "local": data["localNode"]["igpRouterId"],
        "remote": data["remoteNode"]["igpRouterId"],
    }


def parse_prefix(nlri):
    data = nlri["nlri"]

    return {
        "node": data["localNode"]["igpRouterId"],
        "prefixes": data["prefixDescriptor"].get("ipReachability", []),
    }


# -----------------------------
# Core Fetch Logic (shared)
# -----------------------------
def fetch_lsdb():
    nodes, links, prefixes = [], [], []

    with grpc.insecure_channel("gobgp:50051") as channel:
        stub = gobgp_pb2_grpc.GobgpApiStub(channel)

        req = gobgp_pb2.ListPathRequest(
            table_type=gobgp_pb2.TableType.GLOBAL,
            family=gobgp_pb2.Family(
                afi=gobgp_pb2.Family.AFI_LS,
                safi=gobgp_pb2.Family.SAFI_LS,
            ),
        )

        res_stream = stub.ListPath(req)

        for resp in res_stream:
            if not resp.destination:
                continue

            for path in resp.destination.paths:
                if not path.HasField("nlri"):
                    continue

                # Decode NLRI
                _, nlri_dict = unpack_any(path.nlri)

                category = classify_entry(nlri_dict)

                if category == "node":
                    nodes.append(parse_node(nlri_dict))

                elif category == "link":
                    links.append(parse_link(nlri_dict))

                elif category == "prefix":
                    prefixes.append(parse_prefix(nlri_dict))

    return nodes, links, prefixes


# -----------------------------
# Endpoints
# -----------------------------
@router.get("/nodes")
def get_nodes(user: dict = Depends(get_current_user)):
    try:
        nodes, _, _ = fetch_lsdb()
        return {"nodes": nodes}

    except RpcError as e:
        return {"error": e.details(), "code": e.code().name}


@router.get("/links")
def get_links(user: dict = Depends(get_current_user)):
    try:
        _, links, _ = fetch_lsdb()
        return {"links": links}

    except RpcError as e:
        return {"error": e.details(), "code": e.code().name}


@router.get("/prefixes")
def get_prefixes(user: dict = Depends(get_current_user)):
    try:
        _, _, prefixes = fetch_lsdb()
        return {"prefixes": prefixes}

    except RpcError as e:
        return {"error": e.details(), "code": e.code().name}