package main

import (
	"bytes"
	"context"
	"encoding/json"
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
	kafkaTopic      = "telemetry-topic-100"
	opensearchURL   = "http://opensearch:9200"
	opensearchIndex = "telemetry-data"
)

// telemetryFieldsToMap recursively converts TelemetryField slices to nested maps
func telemetryFieldsToMap(fields []*telemetryBis.TelemetryField) map[string]interface{} {
	m := make(map[string]interface{})

	for _, f := range fields {
		if f.Name == "" {
			// Could be a nested grouping field without a name? Check if Fields is non-nil
			if len(f.Fields) > 0 {
				// You can merge nested fields into a map, maybe under some placeholder key
				nestedMap := telemetryFieldsToMap(f.Fields)
				for k, v := range nestedMap {
					m[k] = v
				}
				continue
			}
			log.Printf("⚠️ Skipping field with empty name, value type: %T\n", f.ValueByType)
			continue
		}

		if len(f.Fields) > 0 {
			// Recursively parse nested fields and set under the field name as a nested map
			m[f.Name] = telemetryFieldsToMap(f.Fields)
			continue
		}

		var val interface{}
		switch v := f.ValueByType.(type) {
		case *telemetryBis.TelemetryField_BytesValue:
			val = v.BytesValue
		case *telemetryBis.TelemetryField_StringValue:
			val = v.StringValue
		case *telemetryBis.TelemetryField_BoolValue:
			val = v.BoolValue
		case *telemetryBis.TelemetryField_Uint32Value:
			val = v.Uint32Value
		case *telemetryBis.TelemetryField_Uint64Value:
			val = v.Uint64Value
		case *telemetryBis.TelemetryField_Sint32Value:
			val = v.Sint32Value
		case *telemetryBis.TelemetryField_Sint64Value:
			val = v.Sint64Value
		case *telemetryBis.TelemetryField_DoubleValue:
			val = v.DoubleValue
		case *telemetryBis.TelemetryField_FloatValue:
			val = v.FloatValue
		default:
			log.Printf("⚠️ Unknown or unsupported value type for field %s: %T", f.Name, f.ValueByType)
			val = nil
		}

		m[f.Name] = val
		log.Printf("Parsed field: %s => %v\n", f.Name, val)
	}

	return m
}

func main() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{kafkaBroker},
		Topic:   kafkaTopic,
		GroupID: "telemetry-consumer-group",
	})
	defer reader.Close()

	client, err := opensearch.NewClient(opensearch.Config{
		Addresses: []string{opensearchURL},
	})
	if err != nil {
		log.Fatalf("❌ Failed to create OpenSearch client: %v", err)
	}

	log.Println("🚀 Kafka consumer started. Waiting for telemetry messages...")

	for {
		m, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("❌ Failed to read message from Kafka: %v", err)
			continue
		}

		t := new(telemetryBis.Telemetry)
		if err := proto.Unmarshal(m.Value, t); err != nil {
			log.Printf("❌ Failed to unmarshal protobuf: %v", err)
			continue
		}

		// Parse telemetry statistics data recursively
		statsMap := telemetryFieldsToMap(t.DataGpbkv)

		// Build the document to index in OpenSearch
		doc := map[string]interface{}{
			"node_id":               t.NodeId,
			"subscription":          t.Subscription,
			"collection_id":         t.CollectionId,
			"collection_start_time": t.CollectionStartTime,
			"collection_end_time":   t.CollectionEndTime,
			"msg_timestamp":         t.MsgTimestamp,
			"encoding_path":         t.EncodingPath,
			"stats":                 statsMap,
			"ingested_at":           time.Now().UTC(),
		}

		data, err := json.Marshal(doc)
		if err != nil {
			log.Printf("❌ Failed to marshal document: %v", err)
			continue
		}

		log.Printf("Parsed telemetry stats: %+v", statsMap)

		req := opensearchapi.IndexRequest{
			Index:   opensearchIndex,
			Body:    bytes.NewReader(data),
			Refresh: "true",
		}
		res, err := req.Do(context.Background(), client)
		if err != nil {
			log.Printf("❌ Failed to index document: %v", err)
			continue
		}
		defer res.Body.Close()

		if res.IsError() {
			log.Printf("❌ OpenSearch indexing error: %s", res.String())
		} else {
			log.Println("✅ Document indexed successfully")
		}
	}
}
