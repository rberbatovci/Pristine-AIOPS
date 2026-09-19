package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"time"
	"strings"

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
	opensearchIndex = "bgp-connections"
	kafkaGroupID    = "bgp-connections-group"
	opensearch1 = "http://opensearch-node1:9200"
    opensearch2 = "http://opensearch-node2:9200"
    opensearch3 = "http://opensearch-node3:9200"
)

func setupOpenSearchClient() (*opensearch.Client, error) {
    client, err := opensearch.NewClient(opensearch.Config{
        Addresses: []string{
            opensearch1,
            opensearch2,
            opensearch3,
        },
        // Optional: set retry behavior
        RetryOnStatus: []int{502, 503, 504, 429},
        MaxRetries:    5,
    })
    if err != nil {
        return nil, err
    }

    // Check connection
    res, err := client.Info()
    if err != nil {
        return nil, err
    }
    defer res.Body.Close()

    if res.IsError() {
        bodyBytes, _ := io.ReadAll(res.Body)
        return nil, fmt.Errorf("OpenSearch connection error: %s - %s", res.Status(), string(bodyBytes))
    }

    bodyBytes, err := io.ReadAll(res.Body)
    if err != nil {
        return nil, err
    }

    var info map[string]interface{}
    if err := json.Unmarshal(bodyBytes, &info); err != nil {
        return nil, err
    }

    version := "unknown"
    if vMap, ok := info["version"].(map[string]interface{}); ok {
        if vStr, ok := vMap["number"].(string); ok {
            version = vStr
        }
    }

    log.Printf("Connected to OpenSearch cluster version: %s", version)
    return client, nil
}

func extractInterfaceName(fields []*telemetryBis.TelemetryField) string {
	for _, field := range fields {
		if field.Name == "keys" {
			for _, subfield := range field.Fields {
				if subfield.Name == "name" {
					if val, ok := getValue(subfield).(string); ok {
						return val
					}
				}
			}
		}
	}
	return ""
}

// getValue is a helper function to safely extract the actual value
// from a TelemetryField based on its type.
func getValue(field *telemetryBis.TelemetryField) interface{} {
	switch v := field.ValueByType.(type) {
	case *telemetryBis.TelemetryField_BytesValue:
		return v.BytesValue
	case *telemetryBis.TelemetryField_StringValue:
		return v.StringValue
	case *telemetryBis.TelemetryField_BoolValue:
		return v.BoolValue
	case *telemetryBis.TelemetryField_Uint32Value:
		return v.Uint32Value
	case *telemetryBis.TelemetryField_Uint64Value:
		return v.Uint64Value
	case *telemetryBis.TelemetryField_Sint32Value:
		return v.Sint32Value
	case *telemetryBis.TelemetryField_Sint64Value:
		return v.Sint64Value
	case *telemetryBis.TelemetryField_DoubleValue:
		return v.DoubleValue
	case *telemetryBis.TelemetryField_FloatValue:
		return v.FloatValue
	default:
		// Log an unknown type for debugging purposes.
		log.Printf("⚠️ Unknown field type for %s: %T", field.Name, v)
		return nil
	}
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

	interfaceStats := telemetryFieldsToMap(t.DataGpbkv, "")

	interfaceName, _ := interfaceStats["keys.name"].(string)

	doc := map[string]interface{}{
		"device":        device,
		"interface":	 interfaceName,
		"collection_id": t.CollectionId,
		"timestamp": 	 t.MsgTimestamp,
		"encoding_path": t.EncodingPath,
		"ingested_at":   time.Now().UTC(),
		"stats":		 interfaceStats,
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
		Refresh: "true",
	}

	res, err := req.Do(ctx, osClient)
	if err != nil {
		log.Printf("❌ Failed to index document to OpenSearch (Offset: %d): %v", m.Offset, err)
		return
	}
	defer res.Body.Close()

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

func telemetryFieldsToMap(fields []*telemetryBis.TelemetryField, parentPath string) map[string]interface{} {
	result := make(map[string]interface{})

	cleanParentPath := parentPath
	if cleanParentPath == "content" {
		cleanParentPath = ""
	} else if strings.HasPrefix(cleanParentPath, "content.") {
		cleanParentPath = strings.TrimPrefix(cleanParentPath, "content.")
	}

	for _, field := range fields {
		name := field.Name

		fullPath := name
		if cleanParentPath != "" {
			fullPath = cleanParentPath + "." + name
		}

		if len(field.Fields) > 0 {
			nested := telemetryFieldsToMap(field.Fields, fullPath)
			for k, v := range nested {
				result[k] = v
			}
		} else {
			result[fullPath] = getValue(field)
		}
	}

	return result
}

func createIndexIfNotExists(client *opensearch.Client, indexName string) error {
	// Check if index exists
	existsReq := opensearchapi.IndicesExistsRequest{
		Index: []string{indexName},
	}
	res, err := existsReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to check if index exists: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		log.Printf("ℹ Index [%s] already exists", indexName)
		return nil
	}

	if res.StatusCode != 404 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("unexpected response checking index: %s", string(body))
	}

	// Define index settings and mappings
	indexSettings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"device":        map[string]interface{}{"type": "keyword"},
				"interface":     map[string]interface{}{"type": "keyword"},
				"subscription":  map[string]interface{}{"type": "object"}, // can expand if you want nested
				"collection_id": map[string]interface{}{"type": "long"},
				"timestamp": map[string]interface{}{"type": "date"},
				"encoding_path": map[string]interface{}{"type": "keyword"},
				"ingested_at":   map[string]interface{}{"type": "date"},
				"stats": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"neighbor_id":   map[string]interface{}{"type": "ip"},
						"vrf_name":      map[string]interface{}{"type": "keyword"},
						"afi_safi":      map[string]interface{}{"type": "keyword"},
						"state":         map[string]interface{}{"type": "keyword"},
						"mode":          map[string]interface{}{"type": "keyword"},
						"last_reset":    map[string]interface{}{"type": "keyword"},
						"reset_reason":  map[string]interface{}{"type": "keyword"},
						"total_dropped": map[string]interface{}{"type": "long"},
						"total_established": map[string]interface{}{"type": "long"},
					},
				},
			},
		},
	}

	body, err := json.Marshal(indexSettings)
	if err != nil {
		return fmt.Errorf("failed to marshal index settings: %w", err)
	}

	// Create index
	createReq := opensearchapi.IndicesCreateRequest{
		Index: indexName,
		Body:  bytes.NewReader(body),
	}

	res, err = createReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("error creating index: %s", string(body))
	}

	log.Printf("✅ Created OpenSearch index: %s", indexName)
	return nil
}

func main() {
	
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{kafkaBroker},
		Topic:   kafkaTopic,
		GroupID: kafkaGroupID,
		StartOffset: kafka.FirstOffset,
		CommitInterval: 1 * time.Second,
		MaxBytes: 10e6, // 10MB
	})
	defer func() {
		if err := reader.Close(); err != nil {
			log.Printf("❌ Error closing Kafka reader: %v", err)
		} else {
			log.Println("✅ Kafka reader closed successfully.")
		}
	}()

	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("❌ Application startup failed: %v", err)
	}

	if err := createIndexIfNotExists(osClient, opensearchIndex); err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}

	log.Println("🚀 Kafka consumer started. Waiting for telemetry messages...")

	for {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		m, err := reader.ReadMessage(ctx)
		cancel() 

		if err != nil {
			if err == context.DeadlineExceeded {
				log.Println("⏰ No new Kafka messages within timeout. Retrying...")
				time.Sleep(5 * time.Second) 
				continue
			}
			log.Printf("❌ Failed to read message from Kafka: %v", err)
			time.Sleep(5 * time.Second) 
			continue
		}

		processKafkaMessage(context.Background(), m, osClient)

		if err := reader.CommitMessages(context.Background(), m); err != nil {
			log.Printf("❌ Failed to commit offset for message (Offset: %d): %v", m.Offset, err)
		} else {
			log.Printf("✅ Committed offset %d for message.", m.Offset)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
