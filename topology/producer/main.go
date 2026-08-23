package main

import (
	"context" 
	"log"

	api "github.com/osrg/gobgp/v3/api"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/anypb"
	"google.golang.org/protobuf/proto"
)

func main() {
	conn, err := grpc.Dial("192.168.1.201:50051", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("failed to connect to GoBGP: %v", err)
	}
	defer conn.Close()

	client := api.NewGobgpApiClient(conn)

	// 🔎 Subscribe to table (path) events
	req := &api.WatchEventRequest{
    	Table: &api.WatchEventRequest_Table{
        	Filters: []*api.WatchEventRequest_Table_Filter{
            	{
                	Init: true,
            	},
        	},
    	},
	}

	stream, err := client.WatchEvent(context.Background(), req)
	if err != nil {
		log.Fatalf("failed to watch events: %v", err)
	}

	log.Println("✅ Subscribed to BGP Table updates...")

	for {
		event, err := stream.Recv()
		if err != nil {
			log.Fatalf("stream error: %v", err)
		}

		switch msg := event.Event.(type) {
		case *api.WatchEventResponse_Table:
			for _, path := range msg.Table.Paths {
				raw, _ := protojson.Marshal(path)
				log.Printf("📥 PATH UPDATE: %s", raw)

				if path.IsWithdraw {
					log.Printf("❌ Withdraw: %+v", path)
				} else {
					handlePath(path)
				}
			}

		case *api.WatchEventResponse_Peer:
			log.Printf("👥 Peer event: %+v", msg.Peer)

		default:
			log.Printf("⚠️ Unhandled event type: %T", msg)
		}
	}
}

func handlePath(path *api.Path) {
	if path == nil || path.Nlri == nil {
		return
	}

	// BGP-LS = AFI 16388 / SAFI 71
	if path.Family.Afi != 16388 || path.Family.Safi != 71 {
		return
	}

	// --------------------------------------------------
	// 1. Unmarshal path.Nlri -> LsAddrPrefix
	// --------------------------------------------------

	msg, err := anypb.UnmarshalNew(
		path.Nlri,
		proto.UnmarshalOptions{},
	)
	if err != nil {
		log.Printf("❌ Failed to decode outer NLRI: %v", err)
		return
	}

	addrPrefix, ok := msg.(*api.LsAddrPrefix)
	if !ok {
		log.Printf("❓ Unexpected BGP-LS NLRI type: %T", msg)
		return
	}

	log.Printf("🔎 BGP-LS type: %s", addrPrefix.Type)

	if addrPrefix.Nlri == nil {
		log.Printf("⚠️ LsAddrPrefix contains no NLRI")
		return
	}

	// --------------------------------------------------
	// 2. Unmarshal addrPrefix.Nlri -> actual NLRI
	// --------------------------------------------------

	nlri, err := anypb.UnmarshalNew(
		addrPrefix.Nlri,
		proto.UnmarshalOptions{},
	)
	if err != nil {
		log.Printf("❌ Failed to decode inner NLRI: %v", err)
		return
	}

	// --------------------------------------------------
	// 3. Handle concrete BGP-LS NLRI
	// --------------------------------------------------

	switch nlri := nlri.(type) {

	case *api.LsNodeNLRI:
		log.Printf("📡 NODE: %+v", nlri)

	case *api.LsLinkNLRI:
		log.Printf("🔗 LINK: %+v", nlri)

	case *api.LsPrefixV4NLRI:
		log.Printf("📍 PREFIX-V4: %+v", nlri)

	case *api.LsPrefixV6NLRI:
		log.Printf("📍 PREFIX-V6: %+v", nlri)

	default:
		log.Printf(
			"❓ Unknown inner BGP-LS NLRI type: %T",
			nlri,
		)
	}
}