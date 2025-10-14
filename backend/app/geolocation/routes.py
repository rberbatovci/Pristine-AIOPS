from fastapi import APIRouter
import grpc
from grpc import RpcError
from google.protobuf.any_pb2 import Any as AnyPB
from google.protobuf.json_format import MessageToDict
from . import gobgp_pb2, gobgp_pb2_grpc, attribute_pb2

router = APIRouter()

# Map type_urls to protobuf classes
CLASS_MAP = {
    "LsAddrPrefix": attribute_pb2.LsAddrPrefix,
    "LsAttribute": attribute_pb2.LsAttribute,
    "MpReachNLRIAttribute": attribute_pb2.MpReachNLRIAttribute,
    "OriginAttribute": attribute_pb2.OriginAttribute,
    "AsPathAttribute": attribute_pb2.AsPathAttribute,
    "MultiExitDiscAttribute": attribute_pb2.MultiExitDiscAttribute,
    "LocalPrefAttribute": attribute_pb2.LocalPrefAttribute,
    # add others you want to decode
}

def unpack_any(any_msg):
    type_url = any_msg.type_url
    short_name = type_url.split(".")[-1]  # e.g. "LsAddrPrefix"
    print("DEBUG type_url:", short_name)
    if short_name in CLASS_MAP:
        msg_cls = CLASS_MAP[short_name]
        msg = msg_cls()
        msg.ParseFromString(any_msg.value)
        return short_name, MessageToDict(msg)
    return short_name, {}

def classify_entry(type_url, nlri_dict, ls_attrs):
    # If NLRI is LsAddrPrefix, it’s a prefix
    if type_url == "LsAddrPrefix":
        return "prefix"

    # If we have LsAttribute, inspect it
    if "LsAttribute" in ls_attrs:
        la = ls_attrs["LsAttribute"]
        if "node" in la:
            return "node"
        if "link" in la:
            return "link"
        if "prefix" in la:
            return "prefix"

    return None


@router.get("/geolocation/lsdb")
def get_lsdb():
    try:
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
            nodes, links, prefixes = [], [], []

            for resp in res_stream:
                if not resp.destination:
                    continue

                for path in resp.destination.paths:
                    # Decode NLRI
                    type_url, nlri_dict = (
                        unpack_any(path.nlri) if path.HasField("nlri") else (None, {})
                    )

                    # Decode attributes
                    ls_attrs = {}
                    for pattr in path.pattrs:
                        turl, parsed = unpack_any(pattr)
                        if parsed:
                            ls_attrs[turl] = parsed

                    entry = {
                        "nlri_type": type_url,
                        "nlri": nlri_dict,
                        "attributes": ls_attrs,
                        "is_withdraw": path.is_withdraw,
                    }

                    category = classify_entry(type_url, nlri_dict, ls_attrs)
                    if category == "node":
                        nodes.append(entry)
                    elif category == "link":
                        links.append(entry)
                    elif category == "prefix":
                        prefixes.append(entry)

            return {"nodes": nodes, "links": links, "prefixes": prefixes}

    except RpcError as e:
        return {"error": e.details(), "code": e.code().name}