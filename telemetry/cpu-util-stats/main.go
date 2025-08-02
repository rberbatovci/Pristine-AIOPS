package main

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "reflect"
    "strconv"
    "sync"
    "time"
    "os"

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/golang/protobuf/proto"
	"github.com/opensearch-project/opensearch-go"
    "github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
    "github.com/joho/godotenv"
)


const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "cpu-utilization"
	opensearchURL   = "http://opensearch:9200"
	opensearchIndex = "cpu-utilization"
	kafkaGroupID    = "cpu-utilization-group"
)

var (
	bulkSize        int
	bulkBuffer      []map[string]interface{}
	bulkBufferLock  sync.Mutex
	deviceAlertState = make(map[string]bool)
	stateLock       sync.Mutex
)

var kafkaWriter *kafka.Writer

// extractCPUUtilization iterates through telemetry fields to find and extract
// aggregate CPU utilization metrics. It specifically looks for "cpu-usage"
// and then "cpu-utilization" within it.
//
// This function is designed to extract top-level CPU metrics (e.g., idle, user, system)
// and *ignores* any deeper nested fields that might represent per-process CPU usage,
// as per the requirement. It assumes that the "cpu-utilization" field directly
// contains these aggregate metrics as its immediate sub-fields.
func extractCPUUtilization(fields []*telemetryBis.TelemetryField) map[string]interface{} {
	for _, field := range fields {
		for _, subField := range field.Fields {
			if subField.Name == "content" {
				result := make(map[string]interface{})
				for _, cpuField := range subField.Fields {
					switch cpuField.Name {
					case "five-seconds", "five-seconds-intr", "one-minute", "five-minutes":
						value := getValue(cpuField)
						result[cpuField.Name] = value
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
		log.Printf("⚠️ Unknown field type for %s: %T", field.Name, v)
		return nil
	}
}


func flushBulkToOpenSearch(ctx context.Context, osClient *opensearch.Client, index string) error {
    bulkBufferLock.Lock()
    defer bulkBufferLock.Unlock()

    if len(bulkBuffer) == 0 {
        return nil // nothing to do
    }

    var bulkBody bytes.Buffer
    for _, doc := range bulkBuffer {
        // Add metadata line for bulk API
        meta := fmt.Sprintf(`{ "index": { "_index": "%s" } }%s`, index, "\n")
        bulkBody.WriteString(meta)

        // Add document JSON line
        data, err := json.Marshal(doc)
        if err != nil {
            // skip bad docs but log error
            log.Printf("Failed to marshal doc for bulk indexing: %v", err)
            continue
        }
        bulkBody.Write(data)
        bulkBody.WriteString("\n")
    }

    // Clear buffer since we copied data to bulkBody
    bulkBuffer = nil

    req := opensearchapi.BulkRequest{
        Body:    bytes.NewReader(bulkBody.Bytes()),
        Refresh: "true", // optional, can remove for performance
    }

    res, err := req.Do(ctx, osClient)
    if err != nil {
        return fmt.Errorf("bulk request failed: %w", err)
    }
    defer res.Body.Close()

    body, _ := io.ReadAll(res.Body)
	//log.Printf(" Bulk response: %s", body)

	if res.IsError() {
    	return fmt.Errorf("bulk request error: %s - %s", res.String(), string(body))
	}

    log.Printf(" Bulk indexed %d documents to OpenSearch", len(bulkBuffer))
    return nil
}

func startPeriodicFlush(ctx context.Context, osClient *opensearch.Client, interval time.Duration) {
    ticker := time.NewTicker(interval)
    go func() {
        for {
            select {
            case <-ticker.C:
                if err := flushBulkToOpenSearch(ctx, osClient, opensearchIndex); err != nil {
                    log.Printf("Periodic bulk flush failed: %v", err)
                }
            case <-ctx.Done():
                ticker.Stop()
                return
            }
        }
    }()
}

func setupOpenSearchClient() (*opensearch.Client, error) {
	client, err := opensearch.NewClient(opensearch.Config{
		Addresses: []string{opensearchURL},
	})
	if err != nil {
		return nil, err
	}

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

	log.Printf("Connected to OpenSearch version: %s", version)
	return client, nil
}

func isHighCPU(stats map[string]interface{}) bool {
    if stats == nil {
        return false
    }

    keys := []string{"five-seconds", "one-minute", "five-minutes"}
    for _, k := range keys {
        val, ok := stats[k]
        if !ok {
            return false
        }
        floatVal, ok := convertToFloat(val)
        if !ok || floatVal <= 20 {
            return false
        }
    }

    return true
}

func sendToKafkaSignalTopic(payload []byte, writer *kafka.Writer) {
    if writer == nil {
        log.Println("❌ kafkaWriter is nil, cannot write to Kafka topic")
        return
    }

    err := writer.WriteMessages(context.Background(),
        kafka.Message{
            Value: payload,
        },
    )
    if err != nil {
        log.Printf("❌ Failed to write to Kafka: %v", err)
    } else {
        log.Println("✅ CPU signal written to Kafka")
    }
}

func initKafkaWriter() {
    kafkaWriter = &kafka.Writer{
        Addr:         kafka.TCP(kafkaBroker),
        Topic:        "telemetry-signals",
        Balancer:     &kafka.LeastBytes{},
        RequiredAcks: kafka.RequireAll,
        Async:        false,
        Compression:  kafka.Snappy,
        BatchSize:    100,
        BatchTimeout: 100 * time.Millisecond,
    }
    log.Println("Kafka writer initialized")
}

func convertToFloat(v interface{}) (float64, bool) {
    switch val := v.(type) {
    case float64:
        return val, true
    case float32:
        return float64(val), true
    case int, int32, int64:
        return float64(reflect.ValueOf(val).Int()), true
    case uint, uint32, uint64:
        return float64(reflect.ValueOf(val).Uint()), true
    case string:
        parsed, err := strconv.ParseFloat(val, 64)
        return parsed, err == nil
    default:
        return 0, false
    }
}

func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
    t := new(telemetryBis.Telemetry)
    if err := proto.Unmarshal(m.Value, t); err != nil {
        log.Printf("Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
        return
    }

    statsMap := extractCPUUtilization(t.DataGpbkv)

	if len(statsMap) == 0 {
        return
    }

	log.Printf("🔍 CPU stats: %+v", statsMap)

    device := ""
    if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
        device = nodeID.NodeIdStr
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

    // Determine current CPU status
    highCPU := isHighCPU(statsMap)

    stateLock.Lock()
    alerting := deviceAlertState[device]
    if highCPU {
        if !alerting {
            log.Printf("🚨 High CPU alert triggered for device [%s]", device)
            deviceAlertState[device] = true
        }
        //  Send full doc JSON to Kafka topic
        sendToKafkaSignalTopic(data, kafkaWriter)
    } else {
        if alerting {
            log.Printf("CPU usage normalized for device [%s]", device)
            deviceAlertState[device] = false
        }
    }
    stateLock.Unlock()

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
		log.Printf("ℹIndex [%s] already exists", indexName)
		return nil
	}

	if res.StatusCode != 404 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("unexpected response checking index: %s", string(body))
	}

	// Define optional settings/mappings for the index (customize as needed)
	indexSettings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"device": map[string]interface{}{"type": "keyword"},
				"collection_id": map[string]interface{}{"type": "long"},
				"collection_start_time": map[string]interface{}{"type": "date"},
				"collection_end_time":   map[string]interface{}{"type": "date"},
				"msg_timestamp":         map[string]interface{}{"type": "date"},
				"encoding_path":         map[string]interface{}{"type": "keyword"},
				"ingested_at":           map[string]interface{}{"type": "date"},
				"stats": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"five-seconds":       map[string]interface{}{"type": "float"},
						"five-seconds-intr":  map[string]interface{}{"type": "float"},
						"one-minute":         map[string]interface{}{"type": "float"},
						"five-minutes":       map[string]interface{}{"type": "float"},
					},
				},
			},
		},
	}

	body, err := json.Marshal(indexSettings)
	if err != nil {
		return fmt.Errorf("failed to marshal index settings: %w", err)
	}

	// Create the index
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

	log.Printf("Created OpenSearch index: %s", indexName)
	return nil
}

func main() {
	// Load .env file (optional, safe to ignore errors in production)
	_ = godotenv.Load()

	// Get bulk size and flush interval from env
	bulkSizeEnv := os.Getenv("BULK_SIZE")
	flushIntervalEnv := os.Getenv("FLUSH_INTERVAL_SECONDS")

	var err error
	bulkSize, err = strconv.Atoi(bulkSizeEnv)
	if err != nil || bulkSize <= 0 {
		bulkSize = 10 // default
	}

	flushIntervalSec, err := strconv.Atoi(flushIntervalEnv)
	if err != nil || flushIntervalSec <= 0 {
		flushIntervalSec = 5 // default
	}
	flushInterval := time.Duration(flushIntervalSec) * time.Second

	// Init Kafka Writer and Reader
	initKafkaWriter()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{kafkaBroker},
		Topic:       kafkaTopic,
		GroupID:     kafkaGroupID,
		StartOffset: kafka.FirstOffset,
	})
	defer reader.Close()

	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("Application startup failed: %v", err)
	}

    if err := createIndexIfNotExists(osClient, opensearchIndex); err != nil {
		log.Fatalf("Failed to create index: %v", err)
	}

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Start periodic flush every, say, 5 seconds
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

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
