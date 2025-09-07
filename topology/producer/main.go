package main

import (
	"context"
	"log"

	gobgpapi "github.com/osrg/gobgp/v3/api"
	"google.golang.org/grpc"
)

func main() {
	conn, err := grpc.Dial("gobgp:50051", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	client := gobgpapi.NewGobgpApiClient(conn)

	// Monitor the global table for BGP-LS
	// The EnableAdvertised field is not valid here.
	stream, err := client.Monitor(context.Background(), &gobgpapi.MonitorRequest{
        TableType: gobgpapi.TableType_GLOBAL,
    })
	if err != nil {
		log.Fatalf("failed to start stream: %v", err)
	}

	log.Println("Streaming BGP-LS updates...")
	for {
		path, err := stream.Recv()
		if err != nil {
			log.Fatalf("stream recv error: %v", err)
		}

		log.Printf("Received path: %+v\n", path)
		// Here you can send the path info to Kafka
	}
}