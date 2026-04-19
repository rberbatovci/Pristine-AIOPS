package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log" 
	"time"
	"bytes"
	"io"

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/opensearch-project/opensearch-go"
	"github.com/segmentio/kafka-go"
	"github.com/golang/protobuf/proto"
) 

// RedisClient is a placeholder so this example reads clearly.
// Remove this if you already have a real Redis client type imported.
type RedisClient interface {
	Set(ctx context.Context, key string, value interface{}, expiration time.Duration) RedisStatusCmd
}

type RedisStatusCmd interface {
	Err() error
}

// processKafkaMessage is the main pipeline for a telemetry message.
func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
	// 1. Decode protobuf payload from Kafka.
	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(m.Value, t); err != nil {
		log.Printf("failed to unmarshal protobuf message (topic=%s partition=%d offset=%d): %v",
			m.Topic, m.Partition, m.Offset, err)
		return
	}

	// 2. Extract CPU stats from telemetry payload.
	statsMap := extractCPUUtilization(t.DataGpbkv)
	if len(statsMap) == 0 {
		// No CPU stats in this message; nothing to do.
		return
	}

	// 3. Resolve device identity.
	device := extractDeviceID(t)
	if device == "" {
		log.Printf("dropping telemetry with missing device id (offset=%d)", m.Offset)
		return
	}

	log.Printf("cpu stats received for device=%s stats=%+v", device, statsMap)

	// 4. Cache the latest CPU stats in Redis.
	if err := saveLatestCPUStatsToRedis(ctx, device, t.MsgTimestamp, statsMap); err != nil {
		log.Printf("failed to save CPU stats to Redis for device=%s: %v", device, err)
	}

	// 5. Build the full event document used for OpenSearch and alert signaling.
	doc := map[string]interface{}{
		"device":                device,
		"collection_id":         t.CollectionId,
		"collection_start_time": t.CollectionStartTime,
		"collection_end_time":   t.CollectionEndTime,
		"timestamp":             t.MsgTimestamp,
		"encoding_path":         t.EncodingPath,
		"stats":                 statsMap,
		"ingested_at":           time.Now().UTC(),
	}

	// Marshal once so the same payload can be published to the signal topic if needed.
	data, err := json.Marshal(doc)
	if err != nil {
		log.Printf("failed to marshal document to JSON (offset=%d): %v", m.Offset, err)
		return
	}

	// 6. Add document to the OpenSearch bulk buffer.
	shouldFlush := appendToBulkBuffer(doc)

	// Flush outside the lock.
	if shouldFlush {
		log.Printf("bulk size threshold reached, flushing OpenSearch buffer")
		if err := flushBulkToOpenSearch(ctx, osClient, opensearchIndex); err != nil {
			log.Printf("error flushing bulk buffer: %v", err)
		}
	}

	// 7. Evaluate CPU status and detect state transition.
	highCPU := isHighCPU(statsMap)
	shouldSendAlert, transitionedToNormal := updateAlertState(device, highCPU)

	if shouldSendAlert {
		log.Printf("high CPU alert triggered for device=%s", device)

		// Kafka write happens outside the state lock.
		if err := sendToKafkaSignalTopic(ctx, data, kafkaWriter); err != nil {
			log.Printf("failed to publish CPU alert for device=%s: %v", device, err)
		} else {
			log.Printf("CPU alert published for device=%s", device)
		}
	}

	if transitionedToNormal {
		log.Printf("CPU usage normalized for device=%s", device)
	}
}

// extractDeviceID safely extracts a string device ID from the protobuf oneof.
func extractDeviceID(t *telemetryBis.Telemetry) string {
	if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
		return nodeID.NodeIdStr
	}
	return ""
}

// saveLatestCPUStatsToRedis stores the latest CPU sample for a device.
// Consider adding a TTL if you want stale data to expire automatically.
func saveLatestCPUStatsToRedis(ctx context.Context, device string, timestamp interface{}, statsMap map[string]interface{}) error {
	redisKey := fmt.Sprintf("telemetry:%s:cpu-util", device)

	redisValue := map[string]interface{}{
		"timestamp": timestamp,
		"stats":     statsMap,
	}

	statsJSON, err := json.Marshal(redisValue)
	if err != nil {
		return fmt.Errorf("marshal redis payload: %w", err)
	}

	if err := redisClient.Set(ctx, redisKey, statsJSON, 0).Err(); err != nil {
		return fmt.Errorf("redis set %s: %w", redisKey, err)
	}

	log.Printf("updated Redis key %s with latest CPU stats", redisKey)
	return nil
}

// appendToBulkBuffer adds a document to the shared bulk buffer and returns
// whether the caller should trigger a flush.
func appendToBulkBuffer(doc map[string]interface{}) bool {
	bulkBufferLock.Lock()
	defer bulkBufferLock.Unlock()

	bulkBuffer = append(bulkBuffer, doc)
	return len(bulkBuffer) >= bulkSize
}

// updateAlertState computes whether we crossed a threshold boundary.
// It returns:
// - shouldSendAlert: true only when transitioning from normal -> high
// - transitionedToNormal: true only when transitioning from high -> normal
func updateAlertState(device string, highCPU bool) (shouldSendAlert bool, transitionedToNormal bool) {
	stateLock.Lock()
	defer stateLock.Unlock()

	alerting := deviceAlertState[device]

	switch {
	case highCPU && !alerting:
		deviceAlertState[device] = true
		return true, false

	case !highCPU && alerting:
		deviceAlertState[device] = false
		return false, true

	default:
		// No state transition.
		return false, false
	}
}

// sendToKafkaSignalTopic publishes a signal/event payload to Kafka.
// It uses the caller's context so shutdowns and deadlines propagate correctly.
func sendToKafkaSignalTopic(ctx context.Context, payload []byte, writer *kafka.Writer) error {
	if writer == nil {
		return fmt.Errorf("kafka writer is nil")
	}

	err := writer.WriteMessages(ctx, kafka.Message{
		Value: payload,
	})
	if err != nil {
		return fmt.Errorf("write Kafka message: %w", err)
	}

	return nil
}

// initKafkaWriter configures the producer used for alert/signal events.
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

// closeKafkaWriter should be called during shutdown.
func closeKafkaWriter() {
	if kafkaWriter == nil {
		return
	}
	if err := kafkaWriter.Close(); err != nil {
		log.Printf("failed to close Kafka writer: %v", err)
	}
}
 
