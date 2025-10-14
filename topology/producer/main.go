package main

import (
	"context"
	"fmt"
	"log"

	api "github.com/osrg/gobgp/v3/api"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/anypb"
	"google.golang.org/protobuf/proto"
)

func main() {
	conn, err := grpc.Dial("gobgp:50051", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("failed to connect to GoBGP: %v", err)
	}
	defer conn.Close()

	client := api.NewGobgpApiClient(conn)

	// 🔎 Subscribe to table (path) events
	req := &api.WatchEventRequest{
		Event: &api.WatchEventRequest_Table{
			Table: &api.WatchEventRequest_Table{
				Filters: []*api.WatchEventRequest_Table_Filter{
					{
						Init: true, // include initial dump
						// Type: api.WatchEventRequest_Table_Filter_ADVERTISED, // optional
					},
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

	// Only process BGP-LS (AFI=16388, SAFI=71)
	if path.Family.Afi != 16388 || path.Family.Safi != 71 {
		return
	}

	nlri, err := anypb.UnmarshalNew(path.Nlri, proto.UnmarshalOptions{})
	if err != nil {
		log.Printf("❌ Failed to decode NLRI: %v", err)
		return
	}

	switch nlri := nlri.(type) {
	case *api.LsNodeNLRI:
		fmt.Printf("📡 Node: %+v\n", nlri)
	case *api.LsLinkNLRI:
		fmt.Printf("🔗 Link: %+v\n", nlri)
	case *api.LsPrefixNLRI:
		fmt.Printf("📍 Prefix: %+v\n", nlri)
	default:
		fmt.Printf("❓ Unknown NLRI type: %T\n", nlri)
	}
}
