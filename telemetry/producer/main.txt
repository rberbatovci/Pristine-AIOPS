package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
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
)

// Map subscription IDs to Kafka topics
var subscriptionTopicMap = map[string]string{
	"101": "cpu-utilization",
	"102": "memory-statistics",
	"103": "interface-statistics",
	"104": "bgp-connections",
	"105": "isis-statistics",
}

// Writer pool for topic-based Kafka writers
var (
	writerPool   = make(map[string]*kafka.Writer)
	writerPoolMu sync.Mutex
)

// gRPC server struct
type grpcServer struct {
	dialout.UnimplementedGRPCMdtDialoutServer
}

func main() {
	// Start gRPC server
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

		// Unmarshal telemetry data
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

		// Extract node ID
		var nodeId string
		switch v := telemetryMsg.NodeId.(type) {
		case *telemetryBis.Telemetry_NodeIdStr:
			nodeId = v.NodeIdStr
		default:
			nodeId = "unknown"
		}

		log.Printf("📥 Received telemetry data from device: %s, subscription ID: %s", nodeId, subscriptionId)

		// Send data to Kafka
		go sendToKafkaTopic(subscriptionId, in.Data)

		// Keep-alive response
		if err := stream.Send(&dialout.MdtDialoutArgs{ReqId: in.ReqId}); err != nil {
			log.Printf("❌ Error sending keep-alive: %v", err)
			return err
		}
	}
}

func sendToKafkaTopic(subscriptionId string, data []byte) {
	// Lookup topic
	topic, ok := subscriptionTopicMap[subscriptionId]
	if !ok {
		topic = "telemetry.unknown"
	}

	writer := getKafkaWriter(topic)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := writer.WriteMessages(ctx, kafka.Message{
		Value: data,
		Time:  time.Now(),
	})
	if err != nil {
		log.Printf("❌ Kafka write failed for topic %s: %v", topic, err)
	} else {
		log.Printf("✅ Sent %d bytes to Kafka topic %s", len(data), topic)
	}
}

func getKafkaWriter(topic string) *kafka.Writer {
	writerPoolMu.Lock()
	defer writerPoolMu.Unlock()

	// Reuse writer if it already exists
	if writer, exists := writerPool[topic]; exists {
		return writer
	}

	// Otherwise create a new writer
	writer := &kafka.Writer{
		Addr:         kafka.TCP(kafkaBroker),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Async:        false,
		Compression:  kafka.Snappy, // Optional: compress messages
		BatchSize:    100,          // Optional: tune batch size
		BatchTimeout: 100 * time.Millisecond,
	}

	writerPool[topic] = writer
	log.Printf("🛠️ Created Kafka writer for topic: %s", topic)
	return writer
}
