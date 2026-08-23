package main

import (
	"context"
	"fmt"
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

// ----------------------------
// INIT REDIS
// ----------------------------
func initRedis() {
	rdb = redis.NewClient(&redis.Options{
		Addr: "redis:6379",
	})

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Redis connection failed: %v", err)
	}

	log.Println("Connected to Redis")
}

// ----------------------------
// CPU WEBSOCKET HANDLER
// ----------------------------
func wsCPUHandler(w http.ResponseWriter, r *http.Request) {

	device := r.URL.Query().Get("device")

	if device == "" {
		http.Error(w, "missing device", http.StatusBadRequest)
		return
	}

	// Upgrade connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}
	defer conn.Close()

	// ONLY CPU CHANNEL (NO GLOBAL TRAFFIC)
	channel := fmt.Sprintf("pub:device:%s:cpu", device)

	log.Printf("📡 Subscribing to: %s", channel)

	pubsub := rdb.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {

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

// ----------------------------
// OPTIONAL: PING WS (GLOBAL)
// ----------------------------
func wsPingHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("Incoming WS request: %s %s", r.Method, r.URL.Path)

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Println("WebSocket upgraded successfully")

	pubsub := rdb.Subscribe(ctx, "icmp-ping")
	defer pubsub.Close()

	log.Println("Subscribed to Redis channel: icmp-ping")

	for msg := range pubsub.Channel() {
		log.Printf("Publishing message from Redis: %s", msg.Payload)

		err := conn.WriteMessage(
			websocket.TextMessage,
			[]byte(msg.Payload),
		)
		if err != nil {
			log.Printf("WS write error: %v", err)
			return
		}
	}
}

// ----------------------------
// MEMORY WEBSOCKET HANDLER
// ----------------------------
func wsMemoryHandler(w http.ResponseWriter, r *http.Request) {

	device := r.URL.Query().Get("device")

	if device == "" {
		http.Error(w, "missing device", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}
	defer conn.Close()

	channel := fmt.Sprintf("pub:device:%s:memory", device)

	log.Printf("📡 Subscribing to memory channel: %s", channel)

	pubsub := rdb.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {

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

// ----------------------------
// INTERFACE OPERATIONAL STATISTICS WEBSOCKET HANDLER
// ----------------------------
func wsIfaceOperStatsHandler(w http.ResponseWriter, r *http.Request) {

	device := r.URL.Query().Get("device")

	if device == "" {
		http.Error(w, "missing device", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}
	defer conn.Close()

	channel := fmt.Sprintf("pub:device:%s:iface-oper", device)

	log.Printf("📡 Subscribing to interface operational statistics channel: %s", channel)

	pubsub := rdb.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {

		// Safety filter (prevents accidental cross-topic leakage)
		//if !strings.HasPrefix(msg.Channel, "device.iface-oper-stats.") {
			//continue
		//}

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

// ----------------------------
// INTERFACE  STATISTICS WEBSOCKET HANDLER
// ----------------------------
func wsInterfaceStatisticsHandler(w http.ResponseWriter, r *http.Request) {

	device := r.URL.Query().Get("device")

	if device == "" {
		http.Error(w, "missing device", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("ws upgrade error:", err)
		return
	}
	defer conn.Close()

	channel := fmt.Sprintf("pub:device:%s:iface-stats", device)

	log.Printf("📡 Subscribing to interface statistics channel: %s", channel)

	pubsub := rdb.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()

	for msg := range ch {

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

// ----------------------------
// MAIN
// ----------------------------
func main() { 
	initRedis() 
	http.HandleFunc("/ws/cpu", wsCPUHandler)
	http.HandleFunc("/ws/ping", wsPingHandler)
	http.HandleFunc("/ws/memory", wsMemoryHandler)
	http.HandleFunc("/ws/iface-oper", wsIfaceOperStatsHandler)
	http.HandleFunc("/ws/iface-stats", wsInterfaceStatisticsHandler)
	log.Println("🚀 WebSocket bridge running on :8080") 
	log.Fatal(http.ListenAndServe(":8080", nil))
}