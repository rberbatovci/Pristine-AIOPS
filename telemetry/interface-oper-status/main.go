package main

import (
	"context"
	"log" 
	"fmt" 
	"github.com/golang/protobuf/proto"
	"encoding/json"
	telemetryBis "telemetry/protobuf/telemetry"
)

const (
	kafkaBroker     = "kafka:9092"  
	kafkaGroupID    = "interface-oper-status-group"
	telemetryTopic	= "interface-oper-status"
	kafkaSignalTopic = "telemetry-signals"
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
	Status     string
	Interface 	  string
	Value       []byte
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
 
	ingestChan := make(chan TelemetryMessage, 1000)
	bulkChan := make(chan TelemetryMessage, 2000)
	redisChan := make(chan RedisUpdate, 1000)
	signalChan := make(chan KafkaSignal, 1000)
 
	redisClient := initRedis()
	kafkaWriter := initKafkaWriter()

	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("Failed to init OpenSearch: %v", err)
	}
 
	go startKafkaReader(ctx, ingestChan)

	workerCount := 8
	for i := 0; i < workerCount; i++ {
		go worker(ctx, ingestChan, bulkChan, redisChan, signalChan)
	}

	go bulkIndexer(ctx, osClient, bulkChan)
	go redisWriter(ctx, redisClient, redisChan)
	go pubSubWriter(ctx, redisClient, redisChan)
	go redisStoreAndPublish(ctx, redisClient, redisChan)
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
	bool,
) {
	// 🔴 1. Decode protobuf
	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(msg.Value, t); err != nil {
		log.Printf("❌ Protobuf decode failed: %v", err)
		return TelemetryMessage{}, nil, nil, false
	}
 
	//printTelemetryFields(t.DataGpbkv, "")

	// 🔴 2. Extract CPU stats (reuse your old logic)
	interfaceStats := telemetryFieldsToMap(t.DataGpbkv, "")

	interfaceName, _ := interfaceStats["keys.name"].(string)

	interfaceStatus, _ := interfaceStats["oper-status"].(string)

	if interfaceStatus == "" {
		//log.Println("📊 interfaceStatus is NIL (no CPU data found)")
		return TelemetryMessage{}, nil, nil, false
	} 

	// 🔴 3. Extract device
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

	// 🔴 4. Build normalized message
	doc := TelemetryMessage{
		Device:    device,
		Timestamp: int64(t.MsgTimestamp), 
		Interface: interfaceName,
		Status:    interfaceStatus,
		Value:     msg.Value,
	}

	// 🔴 5. Redis update
	redis := &RedisUpdate{
		Device: device,
		Interface: interfaceName,
		Key:   fmt.Sprintf("set:device:%s:iface-oper:%s", device, interfaceName),
		Value: map[string]interface{}{
			"interface": interfaceName,
			"timestamp": t.MsgTimestamp,
			"stats":     interfaceStats,
		},
	}
 
	// 🔴 6. Alert logic
	var signal *KafkaSignal
	if isInterfaceDown(interfaceStats) {
		payload, _ := json.Marshal(map[string]interface{}{
			"device": device,
			"alert":  "interface_down",
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
