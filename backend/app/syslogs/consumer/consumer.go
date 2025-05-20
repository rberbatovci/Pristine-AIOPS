package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"

	"github.com/Shopify/sarama"
	"github.com/opensearch-project/opensearch-go"
)

type Syslog struct {
	Device  string `json:"device"`
	Message string `json:"message"`
}

func main() {
	// Kafka setup
	kafkaBroker := "localhost:9092"
	topic := "syslog-topic"
	consumer, err := sarama.NewConsumer([]string{kafkaBroker}, nil)
	if err != nil {
		log.Fatalf("Failed to start Kafka consumer: %v", err)
	}
	defer consumer.Close()

	// OpenSearch setup
	opensearchURL := "http://localhost:9200"
	client, err := opensearch.NewClient(opensearch.Config{
		Addresses: []string{opensearchURL},
	})
	if err != nil {
		log.Fatalf("Failed to create OpenSearch client: %v", err)
	}

	// Start consuming messages from Kafka topic
	partitionConsumer, err := consumer.ConsumePartition(topic, 0, sarama.OffsetNewest)
	if err != nil {
		log.Fatalf("Failed to start Kafka partition consumer: %v", err)
	}
	defer partitionConsumer.Close()

	log.Printf("Consuming messages from Kafka topic '%s'...", topic)

	for msg := range partitionConsumer.Messages() {
		// Parse syslog message from Kafka
		var syslog Syslog
		err := json.Unmarshal(msg.Value, &syslog)
		if err != nil {
			log.Printf("Failed to unmarshal message: %v", err)
			continue
		}

		// Create OpenSearch index document
		indexReq := map[string]interface{}{
			"device":  syslog.Device,
			"message": syslog.Message,
		}

		// Convert the document to JSON
		doc, err := json.Marshal(indexReq)
		if err != nil {
			log.Printf("Failed to marshal document for OpenSearch: %v", err)
			continue
		}

		// Convert []byte to io.Reader
		docReader := bytes.NewReader(doc)

		// Insert into OpenSearch
		indexResp, err := client.Index(
			"syslogs", // index name
			docReader, // document content as io.Reader
			client.Index.WithDocumentID(fmt.Sprintf("%d", msg.Offset)), // Using offset as unique ID
			client.Index.WithRefresh("true"),
		)
		if err != nil {
			log.Printf("Failed to insert document into OpenSearch: %v", err)
			continue
		}

		// Check the result
		if indexResp.IsError() {
			log.Printf("Error indexing document: %s", indexResp.String())
			continue
		}

		log.Printf("Successfully indexed syslog message from %s: %s", syslog.Device, syslog.Message)
	}
}
