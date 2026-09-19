
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
	kafkaGroupID     = "interface-statistics-group"
	kafkaSignalTopic = "telemetry-signals"
	telemetryTopic	 = "interface-statistics" 
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
	Interface 	  string
}

// Redis update payload
type RedisUpdate struct {
	Device string
	Interface string
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
	go redisStoreAndPublish(ctx, redisClient, redisChan)

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
	bool,
) {
	// 🔴 1. Decode protobuf
	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(msg.Value, t); err != nil {
		log.Printf("❌ Protobuf decode failed: %v", err)
		return TelemetryMessage{}, nil, nil, false
	}
 
	//debugFields(t.DataGpbkv, "")

	// 🔴 2. Extract CPU stats (reuse your old logic)
	interfaceStats := telemetryFieldsToMap(t.DataGpbkv, "")
 

	interfaceName, _ := interfaceStats["keys.name"].(string)

	if interfaceStats == nil {
		//log.Println("📊 statsMap is NIL (no CPU data found)")
		return TelemetryMessage{}, nil, nil, false
	} 
 
	device := extractDeviceID(t)
	if device == "" {
		log.Printf("⚠️ Missing device ID")
		return TelemetryMessage{}, nil, nil, false
	}

	log.Printf(
    	"📥 Device: %s | Interface: %s | Timestamp: %d | Stats: %+v",
    	device,
    	interfaceName,
    	t.MsgTimestamp,
    	interfaceStats,
	)
 
	doc := TelemetryMessage{
		Device:    device,
		Timestamp: int64(t.MsgTimestamp),
		Stats:     interfaceStats,
		Value:       msg.Value,
		Interface: interfaceName,
	}
 
	redis := &RedisUpdate{
		Device: device,
		Interface: interfaceName,
		Key: fmt.Sprintf("set:device:%s:iface-stats:%s", device, interfaceName),
		Value: map[string]interface{}{ 
			"timestamp": t.MsgTimestamp,
			"stats":     interfaceStats,
		},
	}

	// 🔴 6. Alert logic
	var signal *KafkaSignal
	if hasInterfaceErrors(interfaceStats) {
		payload, _ := json.Marshal(map[string]interface{}{
			"device": device,
			"alert":  "interface_errors",
			"stats":  interfaceStats,
		})

		signal = &KafkaSignal{
			Payload: payload,
		}
	}

	return doc, redis, signal, true
}

/*
========================================================
WORKER
========================================================
*/

func worker(
	ctx context.Context,
	in <-chan TelemetryMessage,
	bulkOut chan<- TelemetryMessage,
	redisOut chan<- RedisUpdate,
	signalOut chan<- KafkaSignal,
) {
	for msg := range in {

		doc, redisUpdate, signal, ok := processMessage(msg)

		// 🚨 skip EVERYTHING if invalid
		if !ok {
			continue
		}

		// only valid messages reach here
		bulkOut <- doc

		if redisUpdate != nil {
			redisOut <- *redisUpdate
		}
		if signal != nil {
			signalOut <- *signal
		}
	}
}



