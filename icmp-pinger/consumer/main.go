package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"

	kafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/redis/go-redis/v9"
)

type PingResult struct {
	Hostname  string `json:"hostname"`
	IP        string `json:"ip"`
	Status    string `json:"status"`
	RTT       int64  `json:"rtt_ms"`
	Timestamp string `json:"timestamp"`
}

var (
	rdb *redis.Client
	ctx = context.Background()
)

const (
	redisAddr       = "redis:6379"
	redisStateHash  = "ping:status"
	redisPubChannel = "icmp-ping"
	kafkaBroker     = "kafka:9092"
	kafkaTopic      = "ping-results"
	kafkaGroup      = "icmp-redis-consumer"
)

func initRedis() {

	rdb = redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("❌ Redis connection failed: %v", err)
	}

	log.Println("✅ Connected to Redis")
}

/*
	saveToRedis stores the latest ping state using the IP address
	as the Redis HASH field.

	Redis structure:

	ping:status
		192.168.1.193 -> JSON
		192.168.1.194 -> JSON
		192.168.1.195 -> JSON

	The same event is also published through Redis Pub/Sub
	on the "icmp-ping" channel for realtime WebSocket updates.
*/
func saveToRedis(result PingResult) error {

	// Validate the IP before writing to Redis.
	if result.IP == "" {
		log.Printf(
			"⚠️ Empty IP received for hostname %q",
			result.Hostname,
		)

		return nil
	}

	// Marshal the complete ping result.
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}

	// ---------------------------------------------------------
	// 1. Store CURRENT state in Redis
	// ---------------------------------------------------------
	//
	// Redis:
	//
	// ping:status
	//   192.168.1.193 -> {...}
	//   192.168.1.194 -> {...}
	//
	// The IP is used as the field because ICMP operates against
	// the IP address.
	//
	err = rdb.HSet(
		ctx,
		redisStateHash,
		result.IP,
		data,
	).Err()

	if err != nil {
		return err
	}

	// ---------------------------------------------------------
	// 2. Build realtime event envelope
	// ---------------------------------------------------------

	event := map[string]interface{}{
		"type":      "icmp-ping",
		"hostname":  result.Hostname,
		"ip":        result.IP,
		"status":    result.Status,
		"rtt_ms":    result.RTT,
		"timestamp": result.Timestamp,
	}

	eventData, err := json.Marshal(event)
	if err != nil {
		return err
	}

	// ---------------------------------------------------------
	// 3. Publish realtime event
	// ---------------------------------------------------------
	//
	// Subscribers such as your WebSocket bridge can subscribe
	// to:
	//
	//     icmp-ping
	//
	// and immediately forward the event to React.
	//
	err = rdb.Publish(
		ctx,
		redisPubChannel,
		eventData,
	).Err()

	if err != nil {
		log.Printf(
			"⚠️ Redis Pub/Sub publish failed for %s: %v",
			result.IP,
			err,
		)

		return err
	}

	return nil
}

func initKafkaConsumer() *kafka.Consumer {

	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": kafkaBroker,
		"group.id":          kafkaGroup,
		"auto.offset.reset": "latest",
	})

	if err != nil {
		log.Fatalf(
			"❌ Kafka consumer failed: %v",
			err,
		)
	}

	err = consumer.SubscribeTopics(
		[]string{kafkaTopic},
		nil,
	)

	if err != nil {
		log.Fatalf(
			"❌ Topic subscribe failed: %v",
			err,
		)
	}

	log.Printf(
		"✅ Subscribed to Kafka topic: %s",
		kafkaTopic,
	)

	return consumer
}

func main() {

	log.Println("🚀 ICMP Redis Consumer starting")

	// ---------------------------------------------------------
	// Redis
	// ---------------------------------------------------------

	initRedis()

	defer func() {
		log.Println("🔌 Closing Redis connection")
		rdb.Close()
	}()

	// ---------------------------------------------------------
	// Kafka
	// ---------------------------------------------------------

	consumer := initKafkaConsumer()

	defer func() {
		log.Println("🔌 Closing Kafka consumer")
		consumer.Close()
	}()

	// ---------------------------------------------------------
	// Signal handling
	// ---------------------------------------------------------

	sigChan := make(chan os.Signal, 1)

	signal.Notify(
		sigChan,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	log.Println("📡 Waiting for Kafka messages")

	run := true

	for run {

		select {

		case sig := <-sigChan:

			log.Printf(
				"🛑 Received signal %v",
				sig,
			)

			run = false

		default:

			// -------------------------------------------------
			// Read Kafka message
			// -------------------------------------------------

			msg, err := consumer.ReadMessage(-1)

			if err != nil {

				if kafkaErr, ok := err.(kafka.Error); ok {

					log.Printf(
						"⚠️ Kafka error: %v",
						kafkaErr,
					)

				} else {

					log.Printf(
						"⚠️ Kafka read error: %v",
						err,
					)
				}

				continue
			}

			// -------------------------------------------------
			// Parse PingResult
			// -------------------------------------------------

			var result PingResult

			if err := json.Unmarshal(
				msg.Value,
				&result,
			); err != nil {

				log.Printf(
					"❌ JSON parse error: %v",
					err,
				)

				continue
			}

			// -------------------------------------------------
			// Validate data
			// -------------------------------------------------

			if result.IP == "" {

				log.Printf(
					"⚠️ Ignoring ping result with empty IP: %+v",
					result,
				)

				continue
			}

			// -------------------------------------------------
			// Save to Redis + publish event
			// -------------------------------------------------

			if err := saveToRedis(result); err != nil {

				log.Printf(
					"❌ Redis write failed for %s: %v",
					result.IP,
					err,
				)

				continue
			}

			// -------------------------------------------------
			// Logging
			// -------------------------------------------------

			log.Printf(
				"✅ %s [%s] status=%s RTT=%dms",
				result.Hostname,
				result.IP,
				result.Status,
				result.RTT,
			)
		}
	}

	log.Println("🛑 Consumer stopped")
}
