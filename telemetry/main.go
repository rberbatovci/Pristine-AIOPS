package main

import (
	"fmt"
	"io"
	"log"
	"net"

	dialout "telemetry/mdt_dialout"
	telemetryBis "telemetry/telemetry"

	"github.com/golang/protobuf/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/peer"
)

// gRPC server handler
type grpcServer struct {
	dialout.UnimplementedGRPCMdtDialoutServer
}

type dummyPeerType struct{}

func (d *dummyPeerType) String() string  { return "Unknown addr" }
func (d *dummyPeerType) Network() string { return "Unknown net" }

var dummyPeer dummyPeerType

func main() {
	port := ":1163" // change to your desired port

	fmt.Println("Starting Cisco gRPC Telemetry Collector")
	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("Failed to listen on port %s: %v", port, err)
	}

	s := grpc.NewServer()
	dialout.RegisterGRPCMdtDialoutServer(s, &grpcServer{})

	fmt.Printf("gRPC server listening on %s\n", port)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("Failed to serve gRPC server: %v", err)
	}
}

// Main telemetry handler
func (s *grpcServer) MdtDialout(stream dialout.GRPCMdtDialout_MdtDialoutServer) error {
	var endpoint *peer.Peer
	var ok bool

	if endpoint, ok = peer.FromContext(stream.Context()); !ok {
		endpoint = &peer.Peer{
			Addr: &dummyPeer,
		}
	}
	fmt.Printf("Receiving telemetry stream from %s\n", endpoint.Addr.String())

	for {
		in, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		go handleTelemetry(in)

		// Respond to keep-alive
		if err := stream.Send(&dialout.MdtDialoutArgs{ReqId: in.ReqId}); err != nil {
			return err
		}
	}
}

// Parse and print telemetry message
func handleTelemetry(data *dialout.MdtDialoutArgs) {
	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(data.Data, t); err != nil {
		log.Printf("Failed to unmarshal telemetry data: %v", err)
		return
	}

	fmt.Println("\n===== Telemetry Data Received =====")
	fmt.Printf("Node ID:          %s\n", t.NodeId)
	fmt.Printf("Subscription ID:  %s\n", t.Subscription)
	///fmt.Printf("Sensor Path:      %s\n", t.SensorPath)
	fmt.Printf("Encoding Path:    %s\n", t.EncodingPath)
	fmt.Printf("Collection ID:    %d\n", t.CollectionId)
	fmt.Printf("Collection Start: %d\n", t.CollectionStartTime)
	fmt.Printf("Msg Timestamp:    %d\n", t.MsgTimestamp)

	if len(t.DataGpbkv) > 0 {
		fmt.Println("Telemetry Fields:")
		for _, field := range t.DataGpbkv {
			printTelemetryField(field, 1)
		}
	} else {
		fmt.Println("No GPBKV data found.")
	}
}

// Recursively print telemetry fields
func printTelemetryField(field *telemetryBis.TelemetryField, indent int) {
	prefix := ""
	for i := 0; i < indent; i++ {
		prefix += "  "
	}

	fmt.Printf("%s- %s: %v\n", prefix, field.Name, field.ValueByType)

	for _, sub := range field.Fields {
		printTelemetryField(sub, indent+1)
	}
}
