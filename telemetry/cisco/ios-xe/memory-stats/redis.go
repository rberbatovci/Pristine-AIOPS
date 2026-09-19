package main

import (
	"context"
	"encoding/json" 
	"log"
	"fmt"

	"github.com/redis/go-redis/v9"
)

func initRedis() *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr: "Redis:6379",
	})

	if err := client.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("Redis failed: %v", err)
	}

	return client
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
	pubSubOut chan<- RedisUpdate,
	signalOut chan<- KafkaSignal,
) {
	for msg := range in {
		doc, redisUpdate, signal, ok := processMessage(msg)

		if !ok {
			continue
		}

		bulkOut <- doc

		if redisUpdate != nil {
			pubSubOut <- *redisUpdate
		}

		if signal != nil {
			signalOut <- *signal
		}
	}
}
 

func redisStoreAndPublish(ctx context.Context, client *redis.Client, in <-chan RedisUpdate) {
	for item := range in {
		data, err := json.Marshal(item.Value)
		if err != nil {
			log.Printf("Marshal error: %v", err)
			continue
		}

		storeKey := fmt.Sprintf("set:device:%s:memory:%s", item.Device, item.Memory)
		if err := client.Set(ctx, storeKey, data, 0).Err(); err != nil {
			log.Printf("Redis Set error on key %s: %v", storeKey, err)
		}

		pubChannel := fmt.Sprintf("pub:device:%s:memory:%s", item.Device, item.Memory)
		if err := client.Publish(ctx, pubChannel, data).Err(); err != nil {
			log.Printf("Redis Publish error on channel %s: %v", pubChannel, err)
		}
	}
}