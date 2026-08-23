package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	api "github.com/osrg/gobgp/v3/api"
	"github.com/segmentio/kafka-go"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/anypb"
	"google.golang.org/protobuf/proto"
)

const (
	defaultGoBGPAddr   = "192.168.1.201:50051"
	defaultKafkaBroker = "kafka:9092"
	defaultKafkaTopic  = "topology-topic"

	kafkaPartitions        = 6
	kafkaReplicationFactor = 1
)

// --------------------------------------------------
// Kafka event structure
// --------------------------------------------------

type TopologyEvent struct {
	Timestamp  string          `json:"timestamp"`
	EventType  string          `json:"event_type"`
	IsWithdraw bool            `json:"is_withdraw"`
	NLRIType   string          `json:"nlri_type,omitempty"`
	Path       json.RawMessage `json:"path"`
}

// --------------------------------------------------
// Main
// --------------------------------------------------

func main() {

	// --------------------------------------------------
	// Configuration
	// --------------------------------------------------

	gobgpAddr := getEnv(
		"GOBGP_ADDR",
		defaultGoBGPAddr,
	)

	kafkaBroker := getEnv(
		"KAFKA_BROKER",
		defaultKafkaBroker,
	)

	kafkaTopic := getEnv(
		"KAFKA_TOPIC",
		defaultKafkaTopic,
	)

	log.Printf("🔌 GoBGP: %s", gobgpAddr)
	log.Printf("📡 Kafka: %s", kafkaBroker)
	log.Printf("📋 Kafka topic: %s", kafkaTopic)

	// --------------------------------------------------
	// Kafka topic
	// --------------------------------------------------

	if err := createTopicIfNeeded(
		kafkaBroker,
		kafkaTopic,
		kafkaPartitions,
		kafkaReplicationFactor,
	); err != nil {

		log.Fatalf(
			"❌ Kafka topic setup failed: %v",
			err,
		)
	}

	// --------------------------------------------------
	// Create Kafka writer
	// --------------------------------------------------

	writer := &kafka.Writer{
		Addr: kafka.TCP(kafkaBroker),

		Topic: kafkaTopic,

		// Spread messages across the 6 partitions.
		Balancer: &kafka.Hash{},

		// Wait for all available replicas.
		// With replication factor 1, this is still one broker.
		RequiredAcks: kafka.RequireAll,

		// Retry temporary Kafka failures.
		MaxAttempts: 10,

		// Flush configuration.
		BatchSize:    1,
		BatchTimeout: 10 * time.Millisecond,
	}

	defer func() {

		if err := writer.Close(); err != nil {

			log.Printf(
				"⚠️ Failed to close Kafka writer: %v",
				err,
			)
		}

	}()

	log.Println("✅ Kafka writer initialized")

	// --------------------------------------------------
	// Connect to GoBGP
	// --------------------------------------------------

	conn, err := grpc.Dial(
		gobgpAddr,
		grpc.WithInsecure(),
	)

	if err != nil {

		log.Fatalf(
			"❌ Failed to connect to GoBGP: %v",
			err,
		)
	}

	defer conn.Close()

	client := api.NewGobgpApiClient(conn)

	log.Println("✅ Connected to GoBGP")

	// --------------------------------------------------
	// Subscribe to GoBGP table events
	// --------------------------------------------------

	req := &api.WatchEventRequest{
		Table: &api.WatchEventRequest_Table{
			Filters: []*api.WatchEventRequest_Table_Filter{
				{
					// Send the current BGP-LS table first.
					Init: true,
				},
			},
		},
	}

	stream, err := client.WatchEvent(
		context.Background(),
		req,
	)

	if err != nil {

		log.Fatalf(
			"❌ Failed to watch GoBGP events: %v",
			err,
		)
	}

	log.Println(
		"✅ Subscribed to BGP Table updates",
	)

	// --------------------------------------------------
	// Receive events
	// --------------------------------------------------

	for {

		event, err := stream.Recv()

		if err != nil {

			log.Fatalf(
				"❌ GoBGP stream error: %v",
				err,
			)
		}

		switch msg := event.Event.(type) {

		// --------------------------------------------------
		// BGP table event
		// --------------------------------------------------

		case *api.WatchEventResponse_Table:

			if msg.Table == nil {
				continue
			}

			for _, path := range msg.Table.Paths {

				if path == nil {
					continue
				}

				// --------------------------------------------------
				// Only process BGP-LS
				// AFI = 16388
				// SAFI = 71
				// --------------------------------------------------

				if path.Family == nil ||
					path.Family.Afi != 16388 ||
					path.Family.Safi != 71 {

					continue
				}

				// --------------------------------------------------
				// Send path to Kafka
				// --------------------------------------------------

				if err := processPath(
					context.Background(),
					writer,
					path,
				); err != nil {

					log.Printf(
						"❌ Failed to process BGP-LS path: %v",
						err,
					)
				}
			}

		// --------------------------------------------------
		// Peer event
		// --------------------------------------------------

		case *api.WatchEventResponse_Peer:

			log.Printf(
				"👥 Peer event: %+v",
				msg.Peer,
			)

		// --------------------------------------------------
		// Unknown event
		// --------------------------------------------------

		default:

			log.Printf(
				"⚠️ Unhandled event type: %T",
				msg,
			)
		}
	}
}

// --------------------------------------------------
// Create Kafka topic if it does not exist
// --------------------------------------------------

func createTopicIfNeeded(
	broker string,
	topic string,
	partitions int,
	replicationFactor int,
) error {

	const maxAttempts = 10

	for attempt := 1; attempt <= maxAttempts; attempt++ {

		log.Printf(
			"🔎 Checking Kafka topic '%s' (attempt %d/%d)",
			topic,
			attempt,
			maxAttempts,
		)

		// --------------------------------------------------
		// Connect to Kafka
		// --------------------------------------------------

		conn, err := kafka.Dial(
			"tcp",
			broker,
		)

		if err != nil {

			log.Printf(
				"⚠️ Kafka connection failed: %v",
				err,
			)

			time.Sleep(2 * time.Second)

			continue
		}

		// --------------------------------------------------
		// Check whether topic exists
		// --------------------------------------------------

		_, err = conn.ReadPartitions(topic)

		if err == nil {

			conn.Close()

			log.Printf(
				"✅ Kafka topic '%s' already exists",
				topic,
			)

			return nil
		}

		log.Printf(
			"ℹ️ Kafka topic '%s' does not exist",
			topic,
		)

		// --------------------------------------------------
		// Create topic
		// --------------------------------------------------

		err = conn.CreateTopics(
			kafka.TopicConfig{
				Topic:             topic,
				NumPartitions:     partitions,
				ReplicationFactor: replicationFactor,
			},
		)

		conn.Close()

		// --------------------------------------------------
		// Topic successfully created
		// --------------------------------------------------

		if err == nil {

			log.Printf(
				"✅ Kafka topic '%s' created successfully",
				topic,
			)

			return nil
		}

		// --------------------------------------------------
		// Topic already exists
		// --------------------------------------------------

		if strings.Contains(
			err.Error(),
			"Topic already exists",
		) {

			log.Printf(
				"✅ Kafka topic '%s' already exists",
				topic,
			)

			return nil
		}

		// --------------------------------------------------
		// Creation failed
		// --------------------------------------------------

		log.Printf(
			"⚠️ Topic creation failed: %v",
			err,
		)

		time.Sleep(2 * time.Second)
	}

	return fmt.Errorf(
		"failed to create Kafka topic '%s' after %d attempts",
		topic,
		maxAttempts,
	)
}

// --------------------------------------------------
// Process one BGP-LS Path
// --------------------------------------------------

func processPath(
	ctx context.Context,
	writer *kafka.Writer,
	path *api.Path,
) error {

	if path == nil || path.Nlri == nil {
		return nil
	}

	// --------------------------------------------------
	// Decode outer LsAddrPrefix
	// --------------------------------------------------

	msg, err := anypb.UnmarshalNew(
		path.Nlri,
		proto.UnmarshalOptions{},
	)

	if err != nil {

		return fmt.Errorf(
			"failed to decode outer NLRI: %w",
			err,
		)
	}

	addrPrefix, ok := msg.(*api.LsAddrPrefix)

	if !ok {

		return fmt.Errorf(
			"unexpected BGP-LS NLRI type: %T",
			msg,
		)
	}

	nlriType := addrPrefix.Type.String()

	// --------------------------------------------------
	// Decode inner NLRI
	// --------------------------------------------------

	var innerNLRI proto.Message

	if addrPrefix.Nlri != nil {

		innerNLRI, err = anypb.UnmarshalNew(
			addrPrefix.Nlri,
			proto.UnmarshalOptions{},
		)

		if err != nil {

			return fmt.Errorf(
				"failed to decode inner NLRI: %w",
				err,
			)
		}
	}

	// --------------------------------------------------
	// Log decoded BGP-LS object
	// --------------------------------------------------

	switch nlri := innerNLRI.(type) {

	case *api.LsNodeNLRI:

		log.Printf(
			"📡 NODE: %+v",
			nlri,
		)

	case *api.LsLinkNLRI:

		log.Printf(
			"🔗 LINK: %+v",
			nlri,
		)

	case *api.LsPrefixV4NLRI:

		log.Printf(
			"📍 PREFIX-V4: %+v",
			nlri,
		)

	case *api.LsPrefixV6NLRI:

		log.Printf(
			"📍 PREFIX-V6: %+v",
			nlri,
		)

	default:

		if innerNLRI != nil {

			log.Printf(
				"❓ Unknown inner BGP-LS NLRI type: %T",
				innerNLRI,
			)
		}
	}

	// --------------------------------------------------
	// Serialize complete GoBGP Path
	// --------------------------------------------------

	rawPath, err := protojson.Marshal(path)

	if err != nil {

		return fmt.Errorf(
			"failed to serialize GoBGP path: %w",
			err,
		)
	}

	// --------------------------------------------------
	// Determine event type
	// --------------------------------------------------

	eventType := "update"

	if path.IsWithdraw {
		eventType = "withdraw"
	}

	// --------------------------------------------------
	// Create Kafka event
	// --------------------------------------------------

	event := TopologyEvent{
		Timestamp: time.Now().
			UTC().
			Format(time.RFC3339Nano),

		EventType: eventType,

		IsWithdraw: path.IsWithdraw,

		NLRIType: nlriType,

		Path: json.RawMessage(rawPath),
	}

	data, err := json.Marshal(event)

	if err != nil {

		return fmt.Errorf(
			"failed to serialize Kafka event: %w",
			err,
		)
	}

	// --------------------------------------------------
	// Kafka message key
	// --------------------------------------------------
	//
	// Using only NLRIType would put all NODE events
	// into the same partition, all LINK events into
	// another partition, etc.
	//
	// sourceId + NLRI type gives us better distribution
	// while still keeping events from the same source
	// together.
	// --------------------------------------------------

	key := buildKafkaKey(
		path,
		nlriType,
	)

	// --------------------------------------------------
	// Send to Kafka
	// --------------------------------------------------

	err = writer.WriteMessages(
		ctx,
		kafka.Message{
			Key:   []byte(key),
			Value: data,
		},
	)

	if err != nil {

		return fmt.Errorf(
			"failed to write Kafka message: %w",
			err,
		)
	}

	// --------------------------------------------------
	// Log successful Kafka message
	// --------------------------------------------------

	log.Printf(
		"📤 Kafka: topic=%s type=%s withdraw=%t key=%s",
		writer.Topic,
		nlriType,
		path.IsWithdraw,
		key,
	)

	return nil
}

// --------------------------------------------------
// Build Kafka message key
// --------------------------------------------------

func buildKafkaKey(
	path *api.Path,
	nlriType string,
) string {

	// sourceId is usually the router advertising
	// the BGP-LS information.

	if path != nil && path.SourceId != "" {

		return fmt.Sprintf(
			"%s:%s",
			path.SourceId,
			nlriType,
		)
	}

	return nlriType
}

// --------------------------------------------------
// Environment helper
// --------------------------------------------------

func getEnv(
	key string,
	defaultValue string,
) string {

	value := os.Getenv(key)

	if value == "" {
		return defaultValue
	}

	return value
}