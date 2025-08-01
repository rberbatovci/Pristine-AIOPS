package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"fmt"
	"time"

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/golang/protobuf/proto"
	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
)

const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "memory-statistics"
	opensearchURL   = "http://opensearch:9200"
	opensearchIndex = "memory-statistics"
	debug           = false // Toggle for verbose logging
)

func extractMemoryStats(fields []*telemetryBis.TelemetryField) map[string]interface{} {
	for _, field := range fields {
		// This is the top-level anonymous wrapper (name == "")
		for _, subField := range field.Fields {
			if subField.Name == "content" {
				result := make(map[string]interface{})
				for _, memField := range subField.Fields {
					switch memField.Name {
					case "total-memory", "used-memory", "free-memory", "lowest-usage", "highest-usage":
						value := getValue(memField)
						result[memField.Name] = value
					}
				}
				if len(result) > 0 {
					return result
				}
			}
		}
	}
	return nil
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

func checkOpenSearchConnection(ctx context.Context, client *opensearch.Client) error {
	res, err := client.Info()
	if err != nil {
		return err
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}

	var info map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &info); err != nil {
		return err
	}

	if versionInfo, ok := info["version"].(map[string]interface{}); ok {
		log.Printf("✅ Connected to OpenSearch version: %s", versionInfo["number"])
	} else {
		log.Printf("✅ Connected to OpenSearch")
	}
	return nil
}

func extractMemoryKey(fields []*telemetryBis.TelemetryField) string {
	for _, field := range fields {
		for _, subField := range field.Fields {
			if subField.Name == "keys" {
				for _, keyField := range subField.Fields {
					if keyField.Name == "name" {
						if val, ok := getValue(keyField).(string); ok {
							return val
						}
					}
				}
			}
		}
	}
	return ""
}

func printTelemetryFields(fields []*telemetryBis.TelemetryField, indent string) {
	for _, field := range fields {
		log.Printf("%s- %s (nested: %d)", indent, field.Name, len(field.Fields))
		if len(field.Fields) > 0 {
			printTelemetryFields(field.Fields, indent+"  ")
		}
	}
}

func createMemoryIndexIfNotExists(client *opensearch.Client, indexName string) error {
	// Check if index exists
	existsReq := opensearchapi.IndicesExistsRequest{
		Index: []string{indexName},
	}
	res, err := existsReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to check if memory index exists: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		log.Printf("ℹ️ Index [%s] already exists", indexName)
		return nil
	}

	if res.StatusCode != 404 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("unexpected response checking memory index: %s", string(body))
	}

	// Define index settings/mappings
	indexSettings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"device":          map[string]interface{}{"type": "keyword"},
				"collection_id":   map[string]interface{}{"type": "long"},
				"msg_timestamp":   map[string]interface{}{"type": "date"},
				"encoding_path":   map[string]interface{}{"type": "keyword"},
				"ingested_at":     map[string]interface{}{"type": "date"},
				"memory":          map[string]interface{}{"type": "keyword"}, // assuming memoryKey is string
				"stats": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"total-memory":   map[string]interface{}{"type": "float"},
						"used-memory":    map[string]interface{}{"type": "float"},
						"free-memory":    map[string]interface{}{"type": "float"},
						"lowest-usage":   map[string]interface{}{"type": "float"},
						"highest-usage":  map[string]interface{}{"type": "float"},
					},
				},
			},
		},
	}

	body, err := json.Marshal(indexSettings)
	if err != nil {
		return fmt.Errorf("failed to marshal memory index settings: %w", err)
	}

	createReq := opensearchapi.IndicesCreateRequest{
		Index: indexName,
		Body:  bytes.NewReader(body),
	}

	res, err = createReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to create memory index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("error creating memory index: %s", string(body))
	}

	log.Printf("✅ Created OpenSearch memory index: %s", indexName)
	return nil
}

func main() {
	ctx := context.Background()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{kafkaBroker},
		Topic:       kafkaTopic,
		GroupID:     "memory-statistics-group",
		StartOffset: kafka.FirstOffset,
	})
	defer reader.Close()

	client, err := opensearch.NewClient(opensearch.Config{
		Addresses: []string{opensearchURL},
	})
	if err != nil {
		log.Fatalf("❌ Failed to create OpenSearch client: %v", err)
	}

	if err := checkOpenSearchConnection(ctx, client); err != nil {
		log.Fatalf("❌ OpenSearch connection failed: %v", err)
	}

	if err := createMemoryIndexIfNotExists(client, opensearchIndex); err != nil {
		log.Fatalf("❌ Failed to create memory index: %v", err)
	}

	for {
		m, err := reader.ReadMessage(ctx)
		if err != nil {
			log.Printf("❌ Kafka read error: %v", err)
			time.Sleep(3 * time.Second)
			continue
		}

		t := new(telemetryBis.Telemetry)
		if err := proto.Unmarshal(m.Value, t); err != nil {
			log.Printf("❌ Protobuf unmarshal error (offset %d): %v", m.Offset, err)
			continue
		}

		//printTelemetryFields(t.DataGpbkv, "")

		device := ""
		if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
			device = nodeID.NodeIdStr
		}

		memoryKey := extractMemoryKey(t.DataGpbkv)

		statsMap := extractMemoryStats(t.DataGpbkv)

		doc := map[string]interface{}{
			"device": device,
			"collection_id":  t.CollectionId,
			"encoding_path":  t.EncodingPath,
			"msg_timestamp":  t.MsgTimestamp,
			"memory":         memoryKey,
			"stats":          statsMap,
			"ingested_at":    time.Now().UTC(),
		}

		data, err := json.Marshal(doc)
		if err != nil {
			log.Printf("❌ JSON marshal error (offset %d): %v", m.Offset, err)
			continue
		}

		log.Printf("✅ Indexing doc for NodeID=%s CollectionID=%d", device, t.CollectionId)

		log.Printf("📦 Sending to OpenSearch:\n%s", string(data))

		req := opensearchapi.IndexRequest{
			Index:   opensearchIndex,
			Body:    bytes.NewReader(data),
			Refresh: "false",
		}

		res, err := req.Do(ctx, client)
		if err != nil {
			log.Printf("❌ OpenSearch index error (offset %d): %v", m.Offset, err)
			continue
		}
		defer res.Body.Close()

		if res.IsError() {
			log.Printf("❌ OpenSearch indexing error (status: %s): %s", res.Status(), res.String())
		} else if debug {
			var respBody map[string]interface{}
			if err := json.NewDecoder(res.Body).Decode(&respBody); err == nil {
				pretty, _ := json.MarshalIndent(respBody, "", "  ")
				log.Printf("📥 OpenSearch index response:\n%s", pretty)
			}
		}
	}
}
