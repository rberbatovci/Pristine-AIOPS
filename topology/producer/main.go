package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	api "github.com/osrg/gobgp/v3/api"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/anypb"
)

func main() {
	for {
		if err := watchBGP(); err != nil {
			log.Printf("Watch error: %v, reconnecting in 3s...", err)
			time.Sleep(3 * time.Second)
		}
	}
}

func watchBGP() error {
	conn, err := grpc.Dial("gobgp:50051", grpc.WithInsecure())
	if err != nil {
		return fmt.Errorf("failed to connect to GoBGP: %v", err)
	}
	defer conn.Close()

	client := api.NewGobgpApiClient(conn)

	req := &api.WatchEventRequest{
		Table: &api.WatchEventRequest_Table{
			// Only specify Table if you want path events.
			// No Type/Family fields here in v3!
		},
	}

	stream, err := client.WatchEvent(context.Background(), req)
	if err != nil {
		return fmt.Errorf("WatchEvent error: %v", err)
	}

	log.Println("Subscribed to GoBGP updates...")

	for {
		event, err := stream.Recv()
		if err != nil {
			return fmt.Errorf("stream closed: %v", err)
		}

		// WatchEventResponse has Path (not Paths) for Table events in v3
		switch e := event.Event.(type) {
		case *api.WatchEventResponse_TableEvent:
			handlePath(e.TableEvent.Paths)
		default:
			log.Printf("Unknown event type: %T", e)
		}
	}
}

func handlePath(path *api.Path) {
	if path == nil {
		return
	}
	nlriMsg, err := anypb.UnmarshalNew(path.Nlri, proto.UnmarshalOptions{})
	if err != nil {
		log.Printf("Failed to decode NLRI: %v", err)
		return
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

	for _, attr := range path.Pattrs {
		attrMsg, _ := anypb.UnmarshalNew(attr, proto.UnmarshalOptions{})
		if ls, ok := attrMsg.(*api.LsAttribute); ok {
			b, _ := json.MarshalIndent(ls, "", "  ")
			fmt.Printf("🔧 LS Attributes: %s\n", string(b))
		}
	}
}