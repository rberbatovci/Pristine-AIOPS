package main

import (
	"encoding/json"
	"log"
	"net"
	"os"
	"strconv"

	"github.com/Shopify/sarama"
)

type Syslog struct {
	Device  string `json:"device"`
	Message string `json:"message"`
}

func main() {
	port := 1160
	if len(os.Args) > 1 {
		p, err := strconv.Atoi(os.Args[1])
		if err != nil {
			log.Fatalf("Invalid port argument: %v", err)
		}
		port = p
	}

	// Kafka setup
	kafkaBroker := "localhost:9092" // Kafka broker address
	topic := "syslog-topic"         // Kafka topic to send data to
	producer, err := sarama.NewSyncProducer([]string{kafkaBroker}, nil)
	if err != nil {
		log.Fatalf("Failed to start Kafka producer: %v", err)
	}
	defer producer.Close()

	addr := net.UDPAddr{
		Port: port,
		IP:   net.ParseIP("0.0.0.0"),
	}
	conn, err := net.ListenUDP("udp", &addr)
	if err != nil {
		log.Fatalf("Failed to listen on UDP port %d: %v", port, err)
	}
	defer conn.Close()

	log.Printf("Listening for syslogs on UDP port %d...", port)

	buf := make([]byte, 2048)
	for {
		n, remoteAddr, err := conn.ReadFromUDP(buf)
		if err != nil {
			log.Printf("Error reading UDP: %v", err)
			continue
		}

		message := string(buf[:n])
		deviceIP := remoteAddr.IP.String()

		syslog := Syslog{
			Device:  deviceIP,
			Message: message,
		}

		// Marshal syslog to JSON
		data, err := json.Marshal(syslog)
		if err != nil {
			log.Printf("JSON marshal error: %v", err)
			continue
		}

		// Send the syslog message to Kafka
		kafkaMessage := &sarama.ProducerMessage{
			Topic: topic,
			Value: sarama.StringEncoder(data),
		}

		_, _, err = producer.SendMessage(kafkaMessage)
		if err != nil {
			log.Printf("Failed to send message to Kafka: %v", err)
			continue
		}

		log.Printf("Sent syslog from %s to Kafka topic '%s': %s", deviceIP, topic, message)
	}
}
