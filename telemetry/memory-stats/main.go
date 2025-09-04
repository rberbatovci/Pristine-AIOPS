package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"fmt"
    "strconv"
	"time"

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/golang/protobuf/proto"
	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
	"github.com/redis/go-redis/v9"
)

const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "memory-statistics"
	kafkaGroupID    = "memory-statistics-group"

	opensearch1 = "http://opensearch-node1:9200"
    opensearch2 = "http://opensearch-node2:9200"
    opensearch3 = "http://opensearch-node3:9200"
	opensearchIndex = "memory-statistics"
)

var (
    flushInterval time.Duration
    bulkSize      int
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

func getEnvInt(key string, defaultVal int) int {
    valStr := os.Getenv(key)
    if valStr == "" {
        return defaultVal
    }
    val, err := strconv.Atoi(valStr)
    if err != nil {
        log.Printf("⚠️ Invalid int for %s=%s, using default %d", key, valStr, defaultVal)
        return defaultVal
    }
    return val
}


func bulkIndex(ctx context.Context, client *opensearch.Client, index string, docs []map[string]interface{}) error {
    var buf bytes.Buffer
    enc := json.NewEncoder(&buf)

    for _, doc := range docs {
        meta := map[string]interface{}{
            "index": map[string]interface{}{
                "_index": index,
            },
        }
        if err := enc.Encode(meta); err != nil {
            return fmt.Errorf("encode meta: %w", err)
        }
        if err := enc.Encode(doc); err != nil {
            return fmt.Errorf("encode doc: %w", err)
        }
    }

    req := opensearchapi.BulkRequest{
        Body:    &buf,
        Refresh: "false",
    }

    res, err := req.Do(ctx, client)
    if err != nil {
        return fmt.Errorf("bulk request: %w", err)
    }
    defer res.Body.Close()

    if res.IsError() {
        return fmt.Errorf("bulk error: %s", res.String())
    }

    return nil
}

func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
    t := new(telemetryBis.Telemetry)
    if err := proto.Unmarshal(m.Value, t); err != nil {
        log.Printf("Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
        return
    }

    statsMap := extractMemoryStats(t.DataGpbkv)

	if len(statsMap) == 0 {
        return
    }

    log.Printf("🔍 Memory stats: %+v", statsMap)

    device := ""
    if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
        device = nodeID.NodeIdStr
    }

    // Save latest Memory stats in Redis
    redisKey := fmt.Sprintf("telemetry:%s:memory-stats", device)
    statsJSON, _ := json.Marshal(statsMap) // convert map to JSON
    if err := redisClient.Set(ctx, redisKey, statsJSON, 0).Err(); err != nil {
        log.Printf("Failed to save Memory stats to Redis for device %s: %v", device, err)
    } else {
        log.Printf("✅ Updated Redis key %s with latest Memory stats", redisKey)
    }

    // Create the full document
    doc := map[string]interface{}{
        "device":                device,
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
        log.Printf("Failed to marshal document to JSON (Offset: %d): %v", m.Offset, err)
        return
    }

    // Buffer doc into bulk buffer
    bulkBufferLock.Lock()
    bulkBuffer = append(bulkBuffer, doc)
    currentSize := len(bulkBuffer)
    bulkBufferLock.Unlock()

    if currentSize >= bulkSize {
        log.Printf("Bulk size limit reached (%d >= %d), flushing buffer...", currentSize, bulkSize)
        if err := flushBulkToOpenSearch(ctx, osClient, opensearchIndex); err != nil {
            log.Printf("Error flushing bulk buffer: %v", err)
        }
    }

    // Determine current Memory status
    highMemory := isHighMemory(statsMap)

    stateLock.Lock()
    alerting := deviceAlertState[device]
    if highMemory {
        if !alerting {
            log.Printf("🚨 High Memory alert triggered for device [%s]", device)
            deviceAlertState[device] = true
        }
        //  Send full doc JSON to Kafka topic
        sendToKafkaSignalTopic(data, kafkaWriter)
    } else {
        if alerting {
            log.Printf("Memory usage normalized for device [%s]", device)
            deviceAlertState[device] = false
        }
    }
    stateLock.Unlock()

}

func main() {
    bulkSize = 1000                     
    flushInterval := 1 * time.Second

	initRedis()

	initKafkaWriter()

    reader := kafka.NewReader(kafka.ReaderConfig{
        Brokers:     []string{"kafka:9092"}, // adjust your brokers
        Topic:       kafkaTopic,
        GroupID:     kafkaGroupID,
        StartOffset: kafka.FirstOffset,
    })
    defer reader.Close()

	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("Application startup failed: %v", err)
	}

    if err := createMemoryIndexIfNotExists(osClient, opensearchIndex); err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    startPeriodicFlush(ctx, osClient, flushInterval)

	log.Println("Kafka consumer started. Waiting for telemetry messages...")

	for {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		m, err := reader.ReadMessage(ctx)
		cancel() 

		if err != nil {
			if err == context.DeadlineExceeded {
				log.Println("No new Kafka messages within timeout. Retrying...")
				time.Sleep(5 * time.Second)
				continue
			}
			time.Sleep(5 * time.Second) 
			continue
		}
		processKafkaMessage(context.Background(), m, osClient)
	}
}