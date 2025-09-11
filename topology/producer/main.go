package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	api "github.com/osrg/gobgp/v3/api"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

func main() {
	// Connect to GoBGP gRPC
	conn, err := grpc.Dial("gobgp:50051", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("Failed to connect to GoBGP: %v", err)
	}
	defer conn.Close()
	client := api.NewGobgpApiClient(conn)

	// Request Link-State RIB
	req := &api.ListPathRequest{
		TableType: api.TableType_GLOBAL,
		Family: &api.Family{
			Afi:  api.Family_AFI_LS,
			Safi: api.Family_SAFI_LS,
		},
	}

	stream, err := client.ListPath(context.Background(), req)
	if err != nil {
		log.Fatalf("ListPath error: %v", err)
	}

	log.Println("Subscribed to GoBGP BGP-LS updates...")

	for {
		resp, err := stream.Recv()
		if err != nil {
			log.Fatalf("Stream error: %v", err)
		}
		if resp.Destination == nil {
			continue
		}

		for _, path := range resp.Destination.Paths {
			// Decode NLRI
			nlriMsg, err := anypb.UnmarshalNew(path.Nlri, proto.UnmarshalOptions{})
			if err != nil {
				log.Printf("Failed to decode NLRI: %v", err)
				continue
			}

			switch nlri := nlriMsg.(type) {
			case *api.LsAddrPrefix:
				fmt.Printf("📡 LS Prefix: %+v\n", nlri)
			case *api.LsNodeNLRI:
				fmt.Printf("📡 LS Node: %+v\n", nlri)
			case *api.LsLinkNLRI:
				fmt.Printf("📡 LS Link: %+v\n", nlri)
			default:
				fmt.Printf("❓ Unknown NLRI type: %T\n", nlri)
			}

			// Decode attributes
			for _, attr := range path.Pattrs {
				attrMsg, _ := anypb.UnmarshalNew(attr, proto.UnmarshalOptions{})
				switch ls := attrMsg.(type) {
				case *api.LsAttribute:
					b, _ := json.MarshalIndent(ls, "", "  ")
					fmt.Printf("🔧 LS Attributes: %s\n", string(b))
				}
			}
		}
	}
}
