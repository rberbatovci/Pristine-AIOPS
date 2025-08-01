package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strconv"
	"sync"
	"time"
	"os/signal"

	dialout "telemetry/protobuf/mdt_dialout"
	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/golang/protobuf/proto"
	"github.com/joho/godotenv"
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

var (
	telemetryPort     string
	dataFlushInterval time.Duration
	dataFlushSize     int
)

// kafkaBatcher buffers and flushes messages in batches to Kafka
type kafkaBatcher struct {
	mu            sync.Mutex
	messages      []kafka.Message
	writer        *kafka.Writer
	flushTicker   *time.Ticker
	flushSize     int
	flushInterval time.Duration
}

func newKafkaBatcher(topic string, flushSize int, flushInterval time.Duration) *kafkaBatcher {
	w := getKafkaWriter(topic)
	b := &kafkaBatcher{
		messages:      make([]kafka.Message, 0, flushSize),
		writer:        w,
		flushSize:     flushSize,
		flushInterval: flushInterval,
		flushTicker:   time.NewTicker(flushInterval),
	}

	go b.flushLoop()

	return b
}

func (b *kafkaBatcher) AddMessage(msg kafka.Message) {
	b.mu.Lock()
	b.messages = append(b.messages, msg)
	shouldFlush := len(b.messages) >= b.flushSize
	b.mu.Unlock()

	if shouldFlush {
		go b.flush()
	}
}

func (b *kafkaBatcher) flushLoop() {
	for range b.flushTicker.C {
		b.flush()
	}
}

func (b *kafkaBatcher) flush() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.messages) == 0 {
		return
	}

	batch := b.messages
	b.messages = make([]kafka.Message, 0, b.flushSize)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := b.writer.WriteMessages(ctx, batch...)
	if err != nil {
		log.Printf("❌ Kafka batch write failed for topic %s: %v", b.writer.Topic, err)
		// Requeue messages on failure
		b.messages = append(b.messages, batch...)
	} else {
		log.Printf("✅ Flushed batch of %d messages to Kafka topic %s", len(batch), b.writer.Topic)
	}
}

// Global batcher pool for topics
var (
	batcherPool   = make(map[string]*kafkaBatcher)
	batcherPoolMu sync.Mutex
)

func getKafkaBatcher(topic string) *kafkaBatcher {
	batcherPoolMu.Lock()
	defer batcherPoolMu.Unlock()

	if b, exists := batcherPool[topic]; exists {
		return b
	}
	b := newKafkaBatcher(topic, dataFlushSize, dataFlushInterval)
	batcherPool[topic] = b
	log.Printf("🛠️ Created Kafka batcher for topic: %s", topic)
	return b
}

func getKafkaWriter(topic string) *kafka.Writer {
	return &kafka.Writer{
		Addr:         kafka.TCP(kafkaBroker),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Async:        false,
		Compression:  kafka.Snappy,
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
	}
}

// gRPC server struct
type grpcServer struct {
	dialout.UnimplementedGRPCMdtDialoutServer
}

func init() {
	err := godotenv.Load()
	if err != nil {
		log.Printf("⚠️ Could not load .env file, relying on environment variables")
	}

	telemetryPort = os.Getenv("TELEMETRY_PORT")
	if telemetryPort == "" {
    	telemetryPort = ":1163"
	} else if telemetryPort[0] != ':' {
    	telemetryPort = ":" + telemetryPort
	}

	flushIntervalStr := os.Getenv("DATA_FLUSH_INTERVAL")
	if flushIntervalStr == "" {
    	flushIntervalStr = "5s"
	} else {
    	// Check if ends with a letter (like 's', 'm')
    	lastChar := flushIntervalStr[len(flushIntervalStr)-1]
    	if lastChar < 'a' || lastChar > 'z' {
        	// If last char is not a letter, append 's' (seconds)
        	flushIntervalStr += "s"
    	}
	}

	dataFlushInterval, err = time.ParseDuration(flushIntervalStr)
	if err != nil {
    	log.Printf("⚠️ Invalid DATA_FLUSH_INTERVAL, using default 5s")
    	dataFlushInterval = 5 * time.Second
	}

	dataFlushSizeStr := os.Getenv("DATA_FLUSH_SIZE")
	if dataFlushSizeStr == "" {
		dataFlushSize = 100
	} else {
		dataFlushSize, err = strconv.Atoi(dataFlushSizeStr)
		if err != nil {
			log.Printf("⚠️ Invalid DATA_FLUSH_SIZE, using default 100")
			dataFlushSize = 100
		}
	}

	log.Printf("🟢 Config: TELEMETRY_PORT=%s, DATA_FLUSH_INTERVAL=%v, DATA_FLUSH_SIZE=%d",
		telemetryPort, dataFlushInterval, dataFlushSize)
}

func flushAllBatchers() {
	batcherPoolMu.Lock()
	defer batcherPoolMu.Unlock()

	for topic, batcher := range batcherPool {
		log.Printf("🔄 Flushing batcher for topic: %s", topic)
		batcher.flush()
	}
}

func main() {
	fmt.Println("🚀 Starting gRPC Telemetry Collector on", telemetryPort)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt)

	go func() {
		<-sigChan
		log.Println("🚦 Graceful shutdown: Flushing Kafka buffers...")
		flushAllBatchers()
		os.Exit(0)
	}()


	lis, err := net.Listen("tcp", telemetryPort)
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

		telemetryMsg := &telemetryBis.Telemetry{}
		if err := proto.Unmarshal(in.Data, telemetryMsg); err != nil {
			log.Printf("❌ Failed to unmarshal telemetry data: %v", err)
			continue
		}

		var subscriptionId string
		switch v := telemetryMsg.Subscription.(type) {
		case *telemetryBis.Telemetry_SubscriptionIdStr:
			subscriptionId = v.SubscriptionIdStr
		default:
			subscriptionId = "unknown"
		}

		var nodeId string
		switch v := telemetryMsg.NodeId.(type) {
		case *telemetryBis.Telemetry_NodeIdStr:
			nodeId = v.NodeIdStr
		default:
			nodeId = "unknown"
		}

		log.Printf("📥 Received telemetry data from device: %s, subscription ID: %s", nodeId, subscriptionId)

		go sendToKafkaTopic(subscriptionId, in.Data)

		if err := stream.Send(&dialout.MdtDialoutArgs{ReqId: in.ReqId}); err != nil {
			log.Printf("❌ Error sending keep-alive: %v", err)
			return err
		}
	}
}

func sendToKafkaTopic(subscriptionId string, data []byte) {
	topic, ok := subscriptionTopicMap[subscriptionId]
	if !ok {
		topic = "telemetry.unknown"
	}

	batcher := getKafkaBatcher(topic)
	batcher.AddMessage(kafka.Message{
		Value: data,
		Time:  time.Now(),
	})
}
