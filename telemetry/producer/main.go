package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"time"

	dialout "telemetry/protobuf/mdt_dialout"
	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/golang/protobuf/proto"
	"github.com/segmentio/kafka-go"
	"google.golang.org/grpc"
)

// Kafka config
const (
	kafkaBroker = "kafka:9092"
	kafkaTopic  = "telemetry-topic"
)

type grpcServer struct {
	dialout.UnimplementedGRPCMdtDialoutServer
}

var kafkaWriter *kafka.Writer

func main() {
	// Initialize Kafka writer
	kafkaWriter = &kafka.Writer{
		Addr:         kafka.TCP(kafkaBroker),
		Topic:        kafkaTopic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Async:        false,
	}
	defer kafkaWriter.Close()

	port := ":1163"
	fmt.Println("🚀 Starting gRPC Telemetry Collector on", port)

	lis, err := net.Listen("tcp", port)
	if err != nil {
		log.Fatalf("❌ Failed to listen: %v", err)
	}

	s := grpc.NewServer()
	dialout.RegisterGRPCMdtDialoutServer(s, &grpcServer{})

	if err := s.Serve(lis); err != nil {
		log.Fatalf("❌ Failed to serve: %v", err)
	}
}

func (s *grpcServer) MdtDialout(stream dialout.GRPCMdtDialout_MdtDialoutServer) error {
	for {
		in, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			log.Printf("❌ Receive error: %v", err)
			return err
		}

		// Unmarshal in.Data into telemetryBis.Telemetry
		telemetryMsg := &telemetryBis.Telemetry{}
		if err := proto.Unmarshal(in.Data, telemetryMsg); err != nil {
			log.Printf("❌ Failed to unmarshal telemetry data: %v", err)
			continue
		}

		// Extract subscription ID
		var subscriptionId string
		switch v := telemetryMsg.Subscription.(type) {
		case *telemetryBis.Telemetry_SubscriptionIdStr:
			subscriptionId = v.SubscriptionIdStr
		default:
			subscriptionId = "unknown"
		}

		// Extract node ID (device name)
		var nodeId string
		switch v := telemetryMsg.NodeId.(type) {
		case *telemetryBis.Telemetry_NodeIdStr:
			nodeId = v.NodeIdStr
		default:
			nodeId = "unknown"
		}

		log.Printf("📥 Received telemetry data from device: %s, subscription ID: %s", nodeId, subscriptionId)

		// Send to Kafka topic based on subscription ID
		go sendToKafkaTopic(subscriptionId, in.Data)

		// Respond to keep-alive
		if err := stream.Send(&dialout.MdtDialoutArgs{ReqId: in.ReqId}); err != nil {
			log.Printf("❌ Error sending keep-alive: %v", err)
			return err
		}
	}
}

func sendToKafkaTopic(subscriptionId string, data []byte) {
	topic := fmt.Sprintf("telemetry-topic-%s", subscriptionId)

	writer := &kafka.Writer{
		Addr:     kafka.TCP(kafkaBroker),
		Topic:    topic,
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := writer.WriteMessages(ctx, kafka.Message{
		Value: data,
	})
	if err != nil {
		log.Printf("❌ Kafka write failed for topic %s: %v", topic, err)
	} else {
		log.Printf("✅ Sent %d bytes to Kafka topic %s", len(data), topic)
	}
}
