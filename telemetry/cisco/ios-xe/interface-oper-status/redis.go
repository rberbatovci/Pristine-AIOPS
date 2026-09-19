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

/*
========================================================
REDIS PUB/SUB WRITER
========================================================
*/

func pubSubWriter(ctx context.Context, client *redis.Client, in <-chan RedisUpdate) {
	for item := range in {
		data, err := json.Marshal(item.Value)
		if err != nil {
			log.Printf("Pub/Sub marshal error: %v", err)
			continue
		}

		// item.Key now acts as your Pub/Sub Channel/Topic name
		err = client.Publish(ctx, item.Key, data).Err()
		if err != nil {
			log.Printf("Redis Pub/Sub publish error on channel %s: %v", item.Key, err)
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

		storeKey := fmt.Sprintf("set:device:%s:iface-oper:%s", item.Device, item.Interface)
		if err := client.Set(ctx, storeKey, data, 0).Err(); err != nil {
			log.Printf("Redis Set error on key %s: %v", storeKey, err)
		}

		pubChannel := fmt.Sprintf("pub:device:%s:iface-oper:%s", item.Device, item.Interface)
		if err := client.Publish(ctx, pubChannel, data).Err(); err != nil {
			log.Printf("Redis Publish error on channel %s: %v", pubChannel, err)
		}
	}
}