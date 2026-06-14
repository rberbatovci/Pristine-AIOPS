package main

import (
	"context"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
)

var (
	ctx = context.Background()
	rdb *redis.Client
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func initRedis() {
	rdb = redis.NewClient(&redis.Options{
		Addr: "redis:6379",
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis connection failed: %v", err)
	}

	log.Println("Connected to Redis")
}

func wsHandler(w http.ResponseWriter, r *http.Request) {

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	log.Println("🔌 WebSocket client connected")

	// 🔥 SUBSCRIBE TO PUB/SUB CHANNEL
	pubsub := rdb.Subscribe(ctx, "device_updates")
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {

		log.Printf("📡 Redis event: %s", msg.Payload)

		err := conn.WriteMessage(
			websocket.TextMessage,
			[]byte(msg.Payload),
		)

		if err != nil {
			log.Println("ws write error:", err)
			return
		}
	}
}

func main() {

	initRedis()

	http.HandleFunc("/ws", wsHandler)

	log.Println("🚀 Redis Pub/Sub WS bridge running on :8080")

	log.Fatal(http.ListenAndServe(":8080", nil))
}