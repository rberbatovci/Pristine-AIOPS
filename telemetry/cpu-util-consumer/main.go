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

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/golang/protobuf/proto"
	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
)


const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "cpu-utilization"
	opensearchURL   = "http://opensearch:9200"
	opensearchIndex = "cpu-utilization"
	kafkaGroupID    = "cpu-utilization-group"
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
		return nil, fmt.Errorf("❌ OpenSearch connection error: %s - %s", res.Status(), string(bodyBytes))
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

	log.Printf("✅ Connected to OpenSearch version: %s", version)
	return client, nil
}

var (
    deviceAlertState = make(map[string]bool)
    stateLock        sync.Mutex
)

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
        Topic:        "cpu-statistics-signals",
        Balancer:     &kafka.LeastBytes{},
        RequiredAcks: kafka.RequireAll,
        Async:        false,
        Compression:  kafka.Snappy,
        BatchSize:    100,
        BatchTimeout: 100 * time.Millisecond,
    }
    log.Println("🛠️ Kafka writer initialized for topic: cpu-statistics-signals")
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
        log.Printf("❌ Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
        return
    }

    statsMap := extractCPUUtilization(t.DataGpbkv)

	if len(statsMap) == 0 {
        return
    }

    device := ""
    if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
        device = nodeID.NodeIdStr
    }

    // Create the full document
    doc := map[string]interface{}{
        "device":                device,
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
        log.Printf("❌ Failed to marshal document to JSON (Offset: %d): %v", m.Offset, err)
        return
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
        // ✅ Send full doc JSON to Kafka topic
        sendToKafkaSignalTopic(data, kafkaWriter)
    } else {
        if alerting {
            log.Printf("✅ CPU usage normalized for device [%s]", device)
            deviceAlertState[device] = false
        }
    }
    stateLock.Unlock()

    // Index to OpenSearch
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
        log.Printf("✅ CPU Utilization statistics for device [%s] indexed successfully", device)
    }
}

func main() {
	
	initKafkaWriter()

	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:     []string{kafkaBroker},
		Topic:       kafkaTopic,
		GroupID:     kafkaGroupID,
		StartOffset: kafka.FirstOffset,
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
