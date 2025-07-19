package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
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

		subscriptionId := ""
		if subID, ok := t.Subscription.(*telemetryBis.Telemetry_SubscriptionIdStr); ok {
			subscriptionId = subID.SubscriptionIdStr
		}

		memoryKey := extractMemoryKey(t.DataGpbkv)

		statsMap := extractMemoryStats(t.DataGpbkv)

		doc := map[string]interface{}{
			"device": device,
			"subscriptionId": subscriptionId,
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
