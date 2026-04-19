package main

import ( 
    "context"  
    "log"  
    "sync"
    "time" 
    "github.com/segmentio/kafka-go"
    "github.com/redis/go-redis/v9"
)


const (
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "cpu-utilization"
	opensearchURL   = "http://opensearch:9200"
	kafkaGroupID    = "cpu-utilization-group"
    kafkaSignalTopic = "telemetry-signals"

	opensearch1 = "http://opensearch-node1:9200"
    opensearch2 = "http://opensearch-node2:9200"
    opensearch3 = "http://opensearch-node3:9200"
    opensearchIndex = "cpu-utilization"
)

var (
	bulkSize        int
	bulkBuffer      []map[string]interface{}
	bulkBufferLock  sync.Mutex
    deviceAlertState = make(map[string]bool)
    stateLock       sync.Mutex
)

var kafkaWriter *kafka.Writer

var redisClient *redis.Client 

var (
    highThreshold float64 = 80.0 // default fallback
    lowThreshold  float64 = 20.0
    thresholdLock sync.RWMutex
) 
 
func main() {
    bulkSize = 1000                     
    flushInterval := 1 * time.Second 

    initRedis()

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

    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    startPeriodicFlush(ctx, osClient, flushInterval)

    conn, err := connectDB()
    if err != nil {
        log.Fatalf("❌ DB connection failed: %v", err)
    }
    defer conn.Close(context.Background())

    // Initial load
    if err := loadCPUThresholds(conn); err != nil {
        log.Fatalf("❌ Failed to load thresholds: %v", err)
    }

    // Refresh every 30 seconds
    startThresholdRefresher(conn, 30*time.Second)

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