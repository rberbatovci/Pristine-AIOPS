package main

import (
	"context"
	"log" 
	"fmt"
	"encoding/json"  
	"github.com/golang/protobuf/proto"
	telemetryBis "telemetry/protobuf/telemetry"
)

/*
========================================================
CONFIG
========================================================
*/

const (
	kafkaBroker      = "kafka:9092" 
	kafkaGroupID     = "cpu-utilization-group"
	kafkaSignalTopic = "telemetry-signals"
	telemetryTopic	 = "cpu-utilization" 
	opensearch1 = "http://opensearch-node1:9200"
	opensearch2 = "http://opensearch-node2:9200"
	opensearch3 = "http://opensearch-node3:9200"
)

/*
========================================================
PIPELINE TYPES
========================================================
*/

// Main message flowing through pipeline
type TelemetryMessage struct {
	Device    string
	Timestamp int64
	Stats     map[string]interface{}
	Value       []byte
}

// Redis update payload
type RedisUpdate struct {
	Key   string
	Value interface{}
}

// Kafka signal message
type KafkaSignal struct {
	Payload []byte
}

type IncomingMessage struct {
	Device string                 `json:"device"`
	Stats  map[string]interface{} `json:"stats"`
}

/*
========================================================
MAIN
========================================================
*/

func main() {
	ctx := context.Background()

	// Channels
	ingestChan := make(chan TelemetryMessage, 1000)
	bulkChan := make(chan TelemetryMessage, 2000)
	redisChan := make(chan RedisUpdate, 1000)
	signalChan := make(chan KafkaSignal, 1000)

	/*
	========================================================
	INIT CLIENTS
	========================================================
	*/

	redisClient := initRedis()
	kafkaWriter := initKafkaWriter()

	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("Failed to init OpenSearch: %v", err)
	}

	/*
	========================================================
	START PIPELINE
	========================================================
	*/

	go startKafkaReader(ctx, ingestChan)

	workerCount := 8
	for i := 0; i < workerCount; i++ {
		go worker(ctx, ingestChan, bulkChan, redisChan, signalChan)
	}

	go bulkIndexer(ctx, osClient, bulkChan)
	go redisWriter(ctx, redisClient, redisChan)
	go kafkaSignalWriter(ctx, kafkaWriter, signalChan)

	log.Println("🚀 Telemetry pipeline started...")

	select {}
} 

/*
========================================================
BUSINESS LOGIC
========================================================
*/

func processMessage(msg TelemetryMessage) (
	TelemetryMessage,
	*RedisUpdate,
	*KafkaSignal,
) {
	// 🔴 1. Decode protobuf
	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(msg.Value, t); err != nil {
		log.Printf("❌ Protobuf decode failed: %v", err)
		return TelemetryMessage{}, nil, nil
	}
 
	//debugFields(t.DataGpbkv, "")

	// 🔴 2. Extract CPU stats (reuse your old logic)
	statsMap := extractCPUUtilization(t.DataGpbkv) 

	if statsMap == nil {
		//log.Println("📊 statsMap is NIL (no CPU data found)")
		return TelemetryMessage{}, nil, nil
	} 

	// 🔴 3. Extract device
	device := extractDeviceID(t)
	if device == "" {
		log.Printf("⚠️ Missing device ID")
		return TelemetryMessage{}, nil, nil
	}

	log.Printf("📥 Device: %s | Stats: %+v", device, statsMap)

	// 🔴 4. Build normalized message
	doc := TelemetryMessage{
		Device:    device,
		Timestamp: int64(t.MsgTimestamp),
		Stats:     statsMap,
		Value:       msg.Value,
	}

	// 🔴 5. Redis update
	redis := &RedisUpdate{
		Key:   fmt.Sprintf("device:%s:cpu", device),
		Value: map[string]interface{}{
			"timestamp": t.MsgTimestamp,
			"stats":     statsMap,
		},
	}

	// 🔴 6. Alert logic
	var signal *KafkaSignal
	if isHighCPU(statsMap) {
		payload, _ := json.Marshal(map[string]interface{}{
			"device": device,
			"alert":  "cpu_high",
			"stats":  statsMap,
		})

		signal = &KafkaSignal{
			Payload: payload,
		}
	}

	return doc, redis, signal
}




