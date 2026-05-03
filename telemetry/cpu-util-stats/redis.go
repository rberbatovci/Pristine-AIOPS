package main

import (
	"context"
	"encoding/json" 
	"log"

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
	redisOut chan<- RedisUpdate,
	signalOut chan<- KafkaSignal,
) {
	for msg := range in {
		doc, redisUpdate, signal := processMessage(msg) 

		bulkOut <- doc

		if redisUpdate != nil {
			redisOut <- *redisUpdate
		}
		if signal != nil {
			signalOut <- *signal
		}
	}
}

/*
========================================================
REDIS WRITER
========================================================
*/

func redisWriter(ctx context.Context, client *redis.Client, in <-chan RedisUpdate) {
	for item := range in {
		data, err := json.Marshal(item.Value)
		if err != nil {
			log.Printf("Redis marshal error: %v", err)
			continue
		}

		err = client.Set(ctx, item.Key, data, 0).Err()
		if err != nil {
			log.Printf("Redis error: %v", err)
		}
	}
}