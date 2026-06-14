package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"strings"
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

func initRedis() {

	rdb = redis.NewClient(&redis.Options{
		Addr: "redis:6379",
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("❌ Redis connection failed: %v", err)
	}

	log.Println("✅ Connected to Redis")
}

func saveToRedis(result PingResult) error {

	key := "ping:" + strings.ToLower(result.Hostname)

	data, err := json.Marshal(result)
	if err != nil {
		return err
	}

	// 1. Store latest state (cache)
	err = rdb.Set(ctx, key, data, 0).Err()
	if err != nil {
		return err
	}

	// 2. Build event envelope (IMPORTANT)
	event := map[string]interface{}{
		"type":      "icmp_ping",
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

	// 3. Publish to Redis Pub/Sub
	err = rdb.Publish(ctx, "device_updates", eventData).Err()
	if err != nil {
		log.Printf("⚠️ Redis publish failed for %s: %v", result.Hostname, err)
	}

	return nil
}

func main() {

	log.Println("🚀 ICMP Redis Consumer starting")

	initRedis()

	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": "kafka:9092",
		"group.id":          "icmp-redis-consumer",
		"auto.offset.reset": "latest",
	})

	if err != nil {
		log.Fatalf("❌ Kafka consumer failed: %v", err)
	}

	defer consumer.Close()

	err = consumer.SubscribeTopics(
		[]string{
			"ping-results",
		},
		nil,
	)

	if err != nil {
		log.Fatalf("❌ Topic subscribe failed: %v", err)
	}

	log.Println("✅ Subscribed to ping-results")

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

			msg, err := consumer.ReadMessage(-1)

			if err != nil {

				if kafkaErr, ok := err.(kafka.Error); ok {
					log.Printf(
						"Kafka error: %v",
						kafkaErr,
					)
				}

				continue
			}

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

			if err := saveToRedis(result); err != nil {

				log.Printf(
					"❌ Redis write failed: %v",
					err,
				)

				continue
			}

			log.Printf(
				"✅ %s (%s) RTT=%dms",
				result.Hostname,
				result.Status,
				result.RTT,
			)
		}
	}

	log.Println("🛑 Consumer stopped")
}