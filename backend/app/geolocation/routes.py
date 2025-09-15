from fastapi import APIRouter
import grpc
from grpc import RpcError
from google.protobuf.any_pb2 import Any as AnyPB
from google.protobuf.json_format import MessageToDict
from . import gobgp_pb2, gobgp_pb2_grpc, attribute_pb2

router = APIRouter()


@router.get("/geolocation/lsdb")
def get_lsdb():
    """
    Return parsed BGP-LS LSDB (nodes, links, prefixes) from GoBGP via gRPC
    """
    try:
        with grpc.insecure_channel("gobgp:50051") as channel:
            stub = gobgp_pb2_grpc.GobgpApiStub(channel)

            req = gobgp_pb2.ListPathRequest(
                table_type=gobgp_pb2.TableType.Value("GLOBAL"),
                family=gobgp_pb2.Family(
                    afi=gobgp_pb2.Family.AFI_LS,
                    safi=gobgp_pb2.Family.SAFI_LS,
                ),
            )

            res_stream = stub.ListPath(req)

            # Collect LSDB objects
            nodes, links, prefixes = [], [], []

            for resp in res_stream:
                if not resp.destination:
                    continue

                for path in resp.destination.paths:
                    nlri_dict, nlri_type = None, None

                    if path.HasField("nlri"):
                        any_nlri = AnyPB()
                        any_nlri.CopyFrom(path.nlri)

                        # Debug: log incoming type_url
                        # print("Incoming NLRI type_url:", any_nlri.type_url)

                        # Try each LS NLRI type
                        for tname, tmsg, ttype in [
                            ("node", attribute_pb2.LsNodeNLRI, "node"),
                            ("link", attribute_pb2.LsLinkNLRI, "link"),
                            ("prefix", attribute_pb2.LsPrefixV4NLRI, "prefix"),
                        ]:
                            try:
                                msg = tmsg()
                                msg.ParseFromString(any_nlri.value)
                                nlri_dict = MessageToDict(msg)
                                nlri_type = ttype
                                break
                            except Exception:
                                continue

                    # Path attributes (optional, not strictly needed for LSDB topology)
                    attrs = []
                    for pattr in path.pattrs:
                        any_attr = AnyPB()
                        any_attr.CopyFrom(pattr)
                        try:
                            ls_attr = attribute_pb2.LsAttribute()
                            ls_attr.ParseFromString(any_attr.value)
                            attrs.append(MessageToDict(ls_attr))
                        except Exception:
                            attrs.append(str(pattr))

                    # Append to proper group
                    entry = {
                        "nlri": nlri_dict,
                        "attrs": attrs,
                        "is_withdraw": path.is_withdraw,
                    }
                    if nlri_type == "node":
                        nodes.append(entry)
                    elif nlri_type == "link":
                        links.append(entry)
                    elif nlri_type == "prefix":
                        prefixes.append(entry)
                    else:
                        # Could add to "unknowns" if you want
                        pass

            # Return grouped results
            return {"nodes": nodes, "links": links, "prefixes": prefixes}

    except RpcError as e:
        return {"error": e.details(), "code": e.code().name}
