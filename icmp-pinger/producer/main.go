package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"os"
	"os/signal" 
	"sync"
	"syscall"
	"time"
	"strconv"
	"net"

	"github.com/go-ping/ping"
	"github.com/segmentio/kafka-go"
	_ "github.com/lib/pq"
)


// =========================
// CONFIG
// =========================

const (
	kafkaBroker = "kafka:9092"
)

var (
	dataFlushSize     = 100
	dataFlushInterval = 5 * time.Second
)

// =========================
// MODELS
// =========================

type Device struct {
	Hostname string
	IP       string
}

type PingResult struct {
	Hostname  string `json:"hostname"`
	IP        string `json:"ip"`
	Status    string `json:"status"`
	RTT       int64  `json:"rtt_ms"`
	Timestamp string `json:"timestamp"`
}


// =========================
// KAFKA BATCHER (same as telemetry)
// =========================

type kafkaBatcher struct {
	mu            sync.Mutex
	messages      []kafka.Message
	writer        *kafka.Writer
	flushTicker   *time.Ticker
	flushSize     int
	flushInterval time.Duration
}

var (
	batcherPool   = make(map[string]*kafkaBatcher)
	batcherPoolMu sync.Mutex
)

func getKafkaWriter(topic string) *kafka.Writer {
	return &kafka.Writer{
		Addr:         kafka.TCP(kafkaBroker),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		RequiredAcks: kafka.RequireAll,
		Compression:  kafka.Snappy,
		BatchSize:    100,
		BatchTimeout: 100 * time.Millisecond,
	}
}

func newKafkaBatcher(topic string, flushSize int, flushInterval time.Duration) *kafkaBatcher {

	b := &kafkaBatcher{
		messages:      make([]kafka.Message, 0, flushSize),
		writer:        getKafkaWriter(topic),
		flushSize:     flushSize,
		flushInterval: flushInterval,
		flushTicker:   time.NewTicker(flushInterval),
	}

	go b.flushLoop()

	return b
}

func (b *kafkaBatcher) AddMessage(msg kafka.Message) {
	b.mu.Lock()
	b.messages = append(b.messages, msg)
	shouldFlush := len(b.messages) >= b.flushSize
	b.mu.Unlock()

	if shouldFlush {
		go b.flush()
	}
}

func (b *kafkaBatcher) flushLoop() {
	for range b.flushTicker.C {
		b.flush()
	}
}

func (b *kafkaBatcher) flush() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.messages) == 0 {
		return
	}

	batch := b.messages
	b.messages = make([]kafka.Message, 0, b.flushSize)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := b.writer.WriteMessages(ctx, batch...)
	if err != nil {
		log.Printf("❌ Kafka batch write failed for topic %s: %v", b.writer.Topic, err)
		// Requeue messages on failure
		b.messages = append(b.messages, batch...)
	} else {
		log.Printf("✅ Flushed batch of %d messages to Kafka topic %s", len(batch), b.writer.Topic)
	}
}

func getKafkaBatcher(topic string) *kafkaBatcher {

	batcherPoolMu.Lock()
	defer batcherPoolMu.Unlock()

	if b, ok := batcherPool[topic]; ok {
		return b
	}

	b := newKafkaBatcher(topic, dataFlushSize, dataFlushInterval)
	batcherPool[topic] = b

	log.Printf("🛠️ Kafka batcher created for topic: %s", topic)

	return b
}


// =========================
// ICMP
// =========================

func pingHost(ip string) (bool, int64) {

	pinger, err := ping.NewPinger(ip)
	if err != nil {
		return false, 0
	}

	pinger.Count = 1
	pinger.Timeout = 2 * time.Second
	pinger.SetPrivileged(true)

	err = pinger.Run()
	if err != nil {
		return false, 0
	}

	stats := pinger.Statistics()

	if stats.PacketsRecv > 0 {
		return true, stats.AvgRtt.Milliseconds()
	}

	return false, 0
}


// =========================
// DB
// =========================

func loadDevices(db *sql.DB) ([]Device, error) {

	rows, err := db.Query(`
		SELECT hostname, ip_address
		FROM devices 
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []Device

	for rows.Next() {

		var d Device

		if err := rows.Scan(&d.Hostname, &d.IP); err != nil {
			log.Printf("scan error: %v", err)
			continue
		}

		devices = append(devices, d)
	}

	return devices, nil
}


// =========================
// WORKER
// =========================

func pingDevice(device Device) {

	alive, rtt := pingHost(device.IP)

	status := "down"
	if alive {
		status = "up"
	}

	result := PingResult{
		Hostname:  device.Hostname,
		IP:        device.IP,
		Status:    status,
		RTT:       rtt,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}

	payload, err := json.Marshal(result)
	if err != nil {
		return
	}

	getKafkaBatcher("ping-results").AddMessage(
		kafka.Message{
			Value: payload,
			Time:  time.Now(),
		},
	)
}

func worker(jobs <-chan Device, wg *sync.WaitGroup) {
	defer wg.Done()

	for device := range jobs {
		pingDevice(device)
	}
}
 

func flushAllBatchers() {
	batcherPoolMu.Lock()
	defer batcherPoolMu.Unlock()

	for topic, batcher := range batcherPool {
		log.Printf("🔄 Flushing batcher for topic: %s", topic)
		batcher.flush()
	}
}

func createTopic(topic string) error {
	conn, err := kafka.Dial("tcp", kafkaBroker)
	if err != nil {
		return err
	}
	defer conn.Close()

	controller, err := conn.Controller()
	if err != nil {
		return err
	}

	controllerConn, err := kafka.Dial("tcp",
		net.JoinHostPort(controller.Host, strconv.Itoa(controller.Port)),
	)
	if err != nil {
		return err
	}
	defer controllerConn.Close()

	err = controllerConn.CreateTopics(kafka.TopicConfig{
		Topic:             topic,
		NumPartitions:     3,
		ReplicationFactor: 1,
	})

	if err != nil && err.Error() != "topic already exists" {
		return err
	}

	log.Println("🛠️ Kafka topic ready:", topic)
	return nil
}

// =========================
// MAIN
// =========================

func main() {

	log.Println("🚀 ICMP pinger starting")

	if kafkaBroker == "" {
		log.Fatal("KAFKA_BROKER is empty")
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal("DB not reachable:", err)
	}

	createTopic("ping-results")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-stop
		log.Println("🚦 Graceful shutdown: Flushing Kafka buffers...")
		flushAllBatchers()
		os.Exit(0)
	}()

	ticker := time.NewTicker(1 * time.Second)

	for {

		log.Println("📡 starting ping cycle")

		devices, err := loadDevices(db)
		if err != nil {
			log.Println("DB error:", err)
			<-ticker.C
			continue
		}

		jobs := make(chan Device)

		var wg sync.WaitGroup

		for i := 0; i < 100; i++ {
			wg.Add(1)
			go worker(jobs, &wg)
		}

		go func() {
			for _, d := range devices {
				jobs <- d
			}
			close(jobs)
		}()

		wg.Wait()

		log.Printf("✅ cycle done (%d devices)", len(devices))

		<-ticker.C
	}
}