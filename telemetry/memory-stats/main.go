package main

import ( 
	"context"  
	"log" 
	"time"
	"sync"    
	"github.com/segmentio/kafka-go"
	"github.com/redis/go-redis/v9"
)
 
const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "memory-statistics"
	kafkaGroupID    = "memory-statistics-group"
	kafkaSignalTopic = "memory-alerts"

	opensearch1 = "http://opensearch-node1:9200"
    opensearch2 = "http://opensearch-node2:9200"
    opensearch3 = "http://opensearch-node3:9200"
	opensearchIndex = "memory-statistics"
)

var (
    flushInterval time.Duration
    bulkSize        int
	bulkBuffer      []map[string]interface{}
	bulkBufferLock  sync.Mutex
	deviceAlertState = make(map[string]bool)
	stateLock       sync.Mutex
)

var kafkaWriter *kafka.Writer

var redisClient *redis.Client
 
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