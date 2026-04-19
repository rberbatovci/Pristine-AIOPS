package main

import ( 
	"context" 
	"log"
	"time" 
	"github.com/segmentio/kafka-go"
	"github.com/redis/go-redis/v9"
)

const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "interface-oper-status"
	opensearchURL   = "http://opensearch:9200"
	opensearchIndex = "interface-oper-status"
	kafkaGroupID    = "interface-oper-status-group"
	opensearch1 = "http://opensearch-node1:9200"
    opensearch2 = "http://opensearch-node2:9200"
    opensearch3 = "http://opensearch-node3:9200"
)

var redisClient *redis.Client
 


func main() {
	
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{kafkaBroker},
		Topic:   kafkaTopic,
		GroupID: kafkaGroupID,
		StartOffset: kafka.FirstOffset,
		CommitInterval: 1 * time.Second,
		MaxBytes: 10e6, // 10MB
	})
	defer func() {
		if err := reader.Close(); err != nil {
			log.Printf("❌ Error closing Kafka reader: %v", err)
		} else {
			log.Println("✅ Kafka reader closed successfully.")
		}
	}()

	initRedis()

	osClient, err := setupOpenSearchClient()
	if err != nil {
		log.Fatalf("❌ Application startup failed: %v", err)
	}

	if err := createIndexIfNotExists(osClient, opensearchIndex); err != nil {
		log.Fatalf("Failed to create index: %v", err)
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
			log.Printf("❌ Failed to read message from Kafka: %v", err)
			time.Sleep(5 * time.Second) 
			continue
		}

		processKafkaMessage(context.Background(), m, osClient)

		if err := reader.CommitMessages(context.Background(), m); err != nil {
			log.Printf("❌ Failed to commit offset for message (Offset: %d): %v", m.Offset, err)
		} else {
			log.Printf("✅ Committed offset %d for message.", m.Offset)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
