package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log" 
	"time"

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/opensearch-project/opensearch-go"
	"github.com/segmentio/kafka-go"
	"github.com/golang/protobuf/proto"
) 

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
        log.Println("✅ Memory signal written to Kafka")
    }
}

func initKafkaWriter() {
    kafkaWriter = &kafka.Writer{
        Addr:         kafka.TCP(kafkaBroker),
        Topic:        kafkaSignalTopic,
        Balancer:     &kafka.LeastBytes{},
        RequiredAcks: kafka.RequireAll,
        Async:        false,
        Compression:  kafka.Snappy,
        BatchSize:    100,
        BatchTimeout: 100 * time.Millisecond,
    }
    log.Println("Kafka writer initialized")
}

func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
    t := new(telemetryBis.Telemetry)
    if err := proto.Unmarshal(m.Value, t); err != nil {
        log.Printf("Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
        return
    }

    log.Printf("📦 Full Telemetry message (Offset %d): %+v", m.Offset, t)

    memory := extractMemoryKey(t.DataGpbkv)
    if memory == "" {
        log.Printf("No memory key found in message (Offset: %d), skipping", m.Offset)
        return
    }
    log.Printf("💡 Memory pool name: %s", memory)

    statsMap := extractMemoryStats(t.DataGpbkv)

	if len(statsMap) == 0 {
        return
    }

    log.Printf("🔍 Memory stats: %+v", statsMap)

    device := ""
    if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
        device = nodeID.NodeIdStr
    }

    redisKey := fmt.Sprintf("telemetry:%s:memory-state", device)

    usage, _ := statsMap["usage"].(int)

    if err := redisClient.HSet(ctx, redisKey, memory, usage).Err(); err != nil {
        log.Printf("Failed to update memory usage in Redis for device %s, memory %s: %v", device, memory, err)
    } else {
        log.Printf("✅ Redis updated: %s -> %s = %d%%", redisKey, memory, usage)
    }

    if err := redisClient.HSet(ctx, redisKey, "timestamp", t.MsgTimestamp).Err(); err != nil {
        log.Printf("Failed to update timestamp in Redis for device %s: %v", device, err)
    } else {
        log.Printf("⏱️ Redis updated: %s -> timestamp = %d", redisKey, t.MsgTimestamp)
    }

    // Create the full document
    doc := map[string]interface{}{
        "device":                device,
        "collection_id":         t.CollectionId,
        "collection_start_time": t.CollectionStartTime,
        "collection_end_time":   t.CollectionEndTime,
        "timestamp":             t.MsgTimestamp,
        "encoding_path":         t.EncodingPath,
        "memory":                memory,
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