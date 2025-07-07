package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"time"

	// Ensure this path is correct for your protobuf definitions
	telemetryBis "telemetry/protobuf/telemetry" // VERIFY THIS PATH IS CORRECT

	"github.com/golang/protobuf/proto"
	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
)

const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "bgp-connections"
	opensearchURL   = "http://opensearch:9200"
	opensearchIndex = "bgp-connections-statistics"
	kafkaGroupID    = "bgp-connections-group"
)


// setupOpenSearchClient initializes and tests the connection to OpenSearch.
func setupOpenSearchClient() (*opensearch.Client, error) {
	client, err := opensearch.NewClient(opensearch.Config{
		Addresses: []string{opensearchURL},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create OpenSearch client: %w", err)
	}

	// Ping the OpenSearch cluster to verify connection
	res, err := client.Info()
	if err != nil {
		return nil, fmt.Errorf("failed to get OpenSearch info: %w", err)
	}
	defer res.Body.Close()

	// Read the response body once to avoid issues with reading a consumed stream.
	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read OpenSearch info response body: %w", err)
	}

	if res.IsError() {
		return nil, fmt.Errorf("❌ OpenSearch connection error: %s - %s", res.Status(), string(bodyBytes))
	}

	var info map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &info); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OpenSearch info response: %w", err)
	}

	version := "unknown"
	if vMap, ok := info["version"].(map[string]interface{}); ok {
		if vStr, ok := vMap["number"].(string); ok {
			version = vStr
		}
	}

	log.Printf("✅ Connected to OpenSearch version: %s", version)
	return client, nil
}

func prettyPrintTelemetry(t *telemetryBis.Telemetry) {
	data, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		log.Printf("❌ Failed to marshal telemetry for printing: %v", err)
		return
	}
	log.Printf("📦 Full Telemetry Object:\n%s", string(data))
}

// processKafkaMessage unmarshals a Kafka message, extracts data, and indexes it into OpenSearch.
func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
	log.Printf("RECEIVED Kafka message from topic %s, partition %d, offset %d. Message size: %d bytes",
		m.Topic, m.Partition, m.Offset, len(m.Value))

	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(m.Value, t); err != nil {
		log.Printf("❌ Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
		// Log a snippet of the malformed message for debugging
		log.Printf("Malformed protobuf message content (first %d bytes): %x...", min(100, len(m.Value)), m.Value[:min(100, len(m.Value))])
		return
	}

	prettyPrintTelemetry(t)

	log.Printf("SUCCESSFULLY Unmarshaled Protobuf. NodeID: %s, CollectionID: %d, DataGpbkv fields count: %d",
		func() string { // Anonymous function to safely get NodeIdStr
			if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
				return nodeID.NodeIdStr
			}
			return "N/A"
		}(), t.CollectionId, len(t.DataGpbkv))

	printTelemetryFields(t.DataGpbkv, "")

	device := ""
	if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
		device = nodeID.NodeIdStr
	}

	doc := map[string]interface{}{
		"device":        device,
		"subscription":  t.Subscription,
		"collection_id": t.CollectionId,
		"msg_timestamp": t.MsgTimestamp,
		"encoding_path": t.EncodingPath,
		"ingested_at":   time.Now().UTC(),
	}

	data, err := json.Marshal(doc)
	if err != nil {
		log.Printf("❌ Failed to marshal document to JSON (Offset: %d): %v", m.Offset, err)
		return
	}

	log.Printf("Parsed telemetry stats for indexing (Offset: %d): %s", m.Offset, string(data))

	req := opensearchapi.IndexRequest{
		Index:   opensearchIndex,
		Body:    bytes.NewReader(data),
		Refresh: "true", // Refresh the index immediately to make the document searchable
	}

	res, err := req.Do(ctx, osClient)
	if err != nil {
		log.Printf("❌ Failed to index document to OpenSearch (Offset: %d): %v", m.Offset, err)
		return
	}
	defer res.Body.Close() // Ensure the response body is closed

	if res.IsError() {
		errorBody, _ := io.ReadAll(res.Body)
		log.Printf("❌ OpenSearch indexing error for Offset %d: %s - %s", m.Offset, res.String(), string(errorBody))
	} else {
		log.Printf("✅ Document from Offset %d indexed successfully. OpenSearch response: %s", m.Offset, res.String())
	}
}

func printTelemetryFields(fields []*telemetryBis.TelemetryField, indent string) {
	for _, field := range fields {
		log.Printf("%s- %s (nested: %d)", indent, field.Name, len(field.Fields))
		if len(field.Fields) > 0 {
			printTelemetryFields(field.Fields, indent+"  ")
		}
	}
}



func main() {
	// Initialize Kafka reader.
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{kafkaBroker},
		Topic:   kafkaTopic,
		GroupID: kafkaGroupID,
		// Start reading from the beginning of the topic if no offset is committed for the group.
		StartOffset: kafka.FirstOffset,
		// Set a commit interval to periodically commit offsets.
		CommitInterval: 1 * time.Second,
		// MaxBytes limits the maximum size of a batch of messages to read.
		MaxBytes: 10e6, // 10MB
	})
	defer func() {
		if err := reader.Close(); err != nil {
			log.Printf("❌ Error closing Kafka reader: %v", err)
		} else {
			log.Println("✅ Kafka reader closed successfully.")
		}
	}()

	// Setup OpenSearch client and verify connection.
	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("❌ Application startup failed: %v", err) // Exit if OpenSearch connection fails
	}

	log.Println("🚀 Kafka consumer started. Waiting for telemetry messages...")

	// Main loop to consume messages from Kafka.
	for {
		// Create a context with a timeout for reading each message.
		// This prevents the consumer from blocking indefinitely if no messages are available.
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		m, err := reader.ReadMessage(ctx)
		cancel() // Ensure the context is cancelled to release resources

		if err != nil {
			if err == context.DeadlineExceeded {
				log.Println("⏰ No new Kafka messages within timeout. Retrying...")
				time.Sleep(5 * time.Second) // Wait before retrying to avoid busy-looping
				continue
			}
			// Handle other Kafka read errors
			log.Printf("❌ Failed to read message from Kafka: %v", err)
			time.Sleep(5 * time.Second) // Wait before retrying
			continue
		}

		// Process the received Kafka message.
		// Using context.Background() for processing allows the processing to complete
		// even if the Kafka read context times out. If processing itself needs a timeout,
		// a new context with a specific timeout should be created here.
		processKafkaMessage(context.Background(), m, osClient)

		// Manually commit the offset after successful processing.
		// This ensures that messages are only committed if they are successfully processed and indexed.
		if err := reader.CommitMessages(context.Background(), m); err != nil {
			log.Printf("❌ Failed to commit offset for message (Offset: %d): %v", m.Offset, err)
		} else {
			log.Printf("✅ Committed offset %d for message.", m.Offset)
		}
	}
}

// min is a helper function to find the minimum of two integers.
// This is useful for slicing to prevent out-of-bounds errors.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
