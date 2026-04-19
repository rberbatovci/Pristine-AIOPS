package main

import (
    "context"
    "log" 
    "github.com/redis/go-redis/v9"
)


func initRedis() {
    redisClient = redis.NewClient(&redis.Options{
        Addr:     "Redis:6379", // or your Redis host:port
        Password: "",               // no password set
        DB:       0,                // default DB
    })

    ctx := context.Background()
    if err := redisClient.Ping(ctx).Err(); err != nil {
        log.Fatalf("Failed to connect to Redis: %v", err)
    }
    log.Println("✅ Connected to Redis")
}