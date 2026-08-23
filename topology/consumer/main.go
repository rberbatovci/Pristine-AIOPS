package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
)

//
// ============================================================
// Configuration
// ============================================================
//

const (
	defaultKafkaBroker = "kafka:9092"
	defaultKafkaTopic  = "topology-topic"
	defaultKafkaGroup  = "topology-consumer"

	defaultOpenSearchURL = "https://opensearch-node1:9200"

	defaultTopologyIndex = "bgp-topology-events"
)

//
// ============================================================
// Topology Event
// ============================================================
//
//
// This matches the JSON produced by topology-producer:
//
// {
//   "timestamp": "...",
//   "event_type": "update",
//   "is_withdraw": false,
//   "nlri_type": "LS_NLRI_NODE",
//   "path": {...}
// }
//
//

type TopologyEvent struct {
	Timestamp  string          `json:"timestamp"`
	EventType  string          `json:"event_type"`
	IsWithdraw bool            `json:"is_withdraw"`
	NLRIType   string          `json:"nlri_type,omitempty"`
	Path       json.RawMessage `json:"path"`
}

//
// ============================================================
// Environment helper
// ============================================================
//

func getEnv(key string, defaultValue string) string {

	value := os.Getenv(key)

	if value == "" {
		return defaultValue
	}

	return value
}

//
// ============================================================
// OpenSearch Client
// ============================================================
//

func setupOpenSearchClient() (*opensearch.Client, error) {

	opensearchURL := getEnv(
		"OPENSEARCH_URL",
		defaultOpenSearchURL,
	)

	log.Printf(
		"🔎 OpenSearch: %s",
		opensearchURL,
	)

	client, err := opensearch.NewClient(
		opensearch.Config{
			Addresses: []string{
				opensearchURL,
			},

			RetryOnStatus: []int{
				502,
				503,
				504,
				429,
			},

			MaxRetries: 5,
		},
	)

	if err != nil {
		return nil, fmt.Errorf(
			"failed to create OpenSearch client: %w",
			err,
		)
	}

	//
	// Test connection
	//

	res, err := client.Info()

	if err != nil {
		return nil, fmt.Errorf(
			"failed to connect to OpenSearch: %w",
			err,
		)
	}

	defer res.Body.Close()

	if res.IsError() {

		body, _ := io.ReadAll(res.Body)

		return nil, fmt.Errorf(
			"OpenSearch error: %s",
			string(body),
		)
	}

	log.Println(
		"✅ Connected to OpenSearch",
	)

	return client, nil
}

//
// ============================================================
// Create OpenSearch Index
// ============================================================
//

func createIndex(
	client *opensearch.Client,
	index string,
) error {

	//
	// Check if index exists
	//

	existsReq := opensearchapi.IndicesExistsRequest{
		Index: []string{
			index,
		},
	}

	res, err := existsReq.Do(
		context.Background(),
		client,
	)

	if err != nil {
		return fmt.Errorf(
			"failed to check index: %w",
			err,
		)
	}

	defer res.Body.Close()

	//
	// Already exists
	//

	if res.StatusCode == 200 {

		log.Printf(
			"ℹ️ Index [%s] already exists",
			index,
		)

		return nil
	}

	//
	// Unexpected response
	//

	if res.StatusCode != 404 {

		body, _ := io.ReadAll(res.Body)

		return fmt.Errorf(
			"unexpected response checking index: %s",
			string(body),
		)
	}

	//
	// Index mapping
	//

	indexSettings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
		},

		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{

				//
				// Event timestamp
				//

				"timestamp": map[string]interface{}{
					"type": "date",
				},

				//
				// When our consumer received it
				//

				"ingested_at": map[string]interface{}{
					"type": "date",
				},

				//
				// update / withdraw
				//

				"event_type": map[string]interface{}{
					"type": "keyword",
				},

				//
				// true / false
				//

				"is_withdraw": map[string]interface{}{
					"type": "boolean",
				},

				//
				// NODE / LINK / PREFIX_V4 / PREFIX_V6
				//

				"nlri_type": map[string]interface{}{
					"type": "keyword",
				},

				//
				// Complete GoBGP path
				//
				// We keep the complete BGP-LS
				// information here.
				//

				"path": map[string]interface{}{
					"type":    "object",
					"enabled": true,
				},
			},
		},
	}

	body, err := json.Marshal(indexSettings)

	if err != nil {
		return fmt.Errorf(
			"failed to marshal index settings: %w",
			err,
		)
	}

	//
	// Create index
	//

	createReq := opensearchapi.IndicesCreateRequest{
		Index: index,
		Body:  bytes.NewReader(body),
	}

	res, err = createReq.Do(
		context.Background(),
		client,
	)

	if err != nil {
		return fmt.Errorf(
			"failed to create index: %w",
			err,
		)
	}

	defer res.Body.Close()

	//
	// Handle errors
	//

	if res.IsError() {

		body, _ := io.ReadAll(res.Body)

		//
		// Another consumer may have created
		// the index at the same time.
		//

		if strings.Contains(
			string(body),
			"resource_already_exists_exception",
		) {

			log.Printf(
				"ℹ️ Index [%s] already exists",
				index,
			)

			return nil
		}

		return fmt.Errorf(
			"create index error: %s",
			string(body),
		)
	}

	log.Printf(
		"✅ Created OpenSearch index: %s",
		index,
	)

	return nil
}

//
// ============================================================
// Bulk Flush
// ============================================================
//

func flushBulk(
	ctx context.Context,
	client *opensearch.Client,
	index string,
	docs []TopologyEvent,
) {

	if len(docs) == 0 {
		return
	}

	var bulkBody bytes.Buffer

	for _, msg := range docs {

		//
		// Bulk metadata
		//

		meta := fmt.Sprintf(
			`{ "index": { "_index": "%s" } }`,
			index,
		)

		bulkBody.WriteString(meta)
		bulkBody.WriteByte('\n')

		//
		// OpenSearch document
		//

		doc := map[string]interface{}{
			"timestamp":   msg.Timestamp,
			"event_type":  msg.EventType,
			"is_withdraw": msg.IsWithdraw,
			"nlri_type":   msg.NLRIType,
			"path":        json.RawMessage(msg.Path),
			"ingested_at": time.Now().UTC(),
		}

		data, err := json.Marshal(doc)

		if err != nil {

			log.Printf(
				"❌ Failed to marshal topology event: %v",
				err,
			)

			continue
		}

		bulkBody.Write(data)
		bulkBody.WriteByte('\n')
	}

	//
	// Bulk request
	//

	req := opensearchapi.BulkRequest{
		Body: bytes.NewReader(
			bulkBody.Bytes(),
		),
	}

	res, err := req.Do(
		ctx,
		client,
	)

	if err != nil {

		log.Printf(
			"❌ OpenSearch bulk request failed: %v",
			err,
		)

		return
	}

	defer res.Body.Close()

	//
	// Check HTTP status
	//

	if res.IsError() {

		body, _ := io.ReadAll(res.Body)

		log.Printf(
			"❌ OpenSearch bulk error: %s",
			string(body),
		)

		return
	}

	//
	// IMPORTANT:
	//
	// Bulk API can return HTTP 200 even if
	// individual documents failed.
	//

	var bulkResponse struct {
		Errors bool `json:"errors"`
		Items  []map[string]struct {
			Status int `json:"status"`
			Error  interface{} `json:"error,omitempty"`
		} `json:"index"`
	}

	body, err := io.ReadAll(res.Body)

	if err != nil {

		log.Printf(
			"⚠️ Failed to read bulk response: %v",
			err,
		)

		return
	}

	if err := json.Unmarshal(
		body,
		&bulkResponse,
	); err != nil {

		log.Printf(
			"⚠️ Failed to decode bulk response: %v",
			err,
		)

		return
	}

	if bulkResponse.Errors {

		log.Printf(
			"⚠️ Some topology events failed to index",
		)

		for _, item := range bulkResponse.Items {

			for _, result := range item {

				if result.Status >= 300 {

					log.Printf(
						"❌ OpenSearch document error: status=%d error=%v",
						result.Status,
						result.Error,
					)
				}
			}
		}

		return
	}

	log.Printf(
		"💾 OpenSearch: indexed %d topology events",
		len(docs),
	)
}

//
// ============================================================
// Bulk Indexer
// ============================================================
//

func bulkIndexer(
	ctx context.Context,
	client *opensearch.Client,
	index string,
	in <-chan TopologyEvent,
) {

	//
	// Flush every second
	//

	ticker := time.NewTicker(
		1 * time.Second,
	)

	defer ticker.Stop()

	//
	// Maximum batch size
	//

	buffer := make(
		[]TopologyEvent,
		0,
		1000,
	)

	for {

		select {

		//
		// New Kafka event
		//

		case msg, ok := <-in:

			if !ok {

				//
				// Flush remaining documents
				//

				if len(buffer) > 0 {

					flushBulk(
						ctx,
						client,
						index,
						buffer,
					)
				}

				return
			}

			buffer = append(
				buffer,
				msg,
			)

			//
			// Flush immediately at 1000
			//

			if len(buffer) >= 1000 {

				flushBulk(
					ctx,
					client,
					index,
					buffer,
				)

				buffer = buffer[:0]
			}

		//
		// One second elapsed
		//

		case <-ticker.C:

			if len(buffer) > 0 {

				flushBulk(
					ctx,
					client,
					index,
					buffer,
				)

				buffer = buffer[:0]
			}
		}
	}
}

//
// ============================================================
// Kafka Consumer
// ============================================================
//

func consumeKafka(
	ctx context.Context,
	reader *kafka.Reader,
	out chan<- TopologyEvent,
) {

	for {

		msg, err := reader.ReadMessage(ctx)

		if err != nil {

			if ctx.Err() != nil {
				return
			}

			log.Printf(
				"❌ Kafka read error: %v",
				err,
			)

			continue
		}

		//
		// Decode Kafka JSON
		//

		var event TopologyEvent

		if err := json.Unmarshal(
			msg.Value,
			&event,
		); err != nil {

			log.Printf(
				"❌ Failed to decode Kafka message: %v",
				err,
			)

			continue
		}

		//
		// Send to bulk indexer
		//

		out <- event

		log.Printf(
			"📥 Kafka: partition=%d offset=%d type=%s withdraw=%t",
			msg.Partition,
			msg.Offset,
			event.NLRIType,
			event.IsWithdraw,
		)
	}
}

//
// ============================================================
// Main
// ============================================================
//

func main() {

	//
	// ---------------------------------------------------------
	// Configuration
	// ---------------------------------------------------------
	//

	kafkaBroker := getEnv(
		"KAFKA_BROKER",
		defaultKafkaBroker,
	)

	kafkaTopic := getEnv(
		"KAFKA_TOPIC",
		defaultKafkaTopic,
	)

	kafkaGroup := getEnv(
		"KAFKA_GROUP",
		defaultKafkaGroup,
	)

	topologyIndex := getEnv(
		"OPENSEARCH_INDEX",
		defaultTopologyIndex,
	)

	log.Println(
		"==========================================",
	)

	log.Printf(
		"📡 Kafka: %s",
		kafkaBroker,
	)

	log.Printf(
		"📋 Kafka topic: %s",
		kafkaTopic,
	)

	log.Printf(
		"👥 Kafka group: %s",
		kafkaGroup,
	)

	log.Printf(
		"📁 OpenSearch index: %s",
		topologyIndex,
	)

	log.Println(
		"==========================================",
	)

	//
	// ---------------------------------------------------------
	// OpenSearch
	// ---------------------------------------------------------
	//

	client, err := setupOpenSearchClient()

	if err != nil {

		log.Fatalf(
			"❌ OpenSearch client initialization failed: %v",
			err,
		)
	}

	log.Println(
		"✅ OpenSearch client initialized",
	)

	//
	// Create index
	//

	if err := createIndex(
		client,
		topologyIndex,
	); err != nil {

		log.Fatalf(
			"❌ Failed to create OpenSearch index: %v",
			err,
		)
	}

	//
	// ---------------------------------------------------------
	// Kafka Reader
	// ---------------------------------------------------------
	//

	reader := kafka.NewReader(
		kafka.ReaderConfig{

			Brokers: []string{
				kafkaBroker,
			},

			Topic: kafkaTopic,

			GroupID: kafkaGroup,

			//
			// Start reading relatively small
			// messages efficiently.
			//

			MinBytes: 1,

			MaxBytes: 10e6,

			MaxWait: 500 * time.Millisecond,

			//
			// Commit offsets automatically after
			// ReadMessage returns.
			//

			CommitInterval: 1 * time.Second,
		},
	)

	defer reader.Close()

	log.Println(
		"✅ Kafka consumer initialized",
	)

	//
	// ---------------------------------------------------------
	// Event channel
	// ---------------------------------------------------------
	//

	eventChannel := make(
		chan TopologyEvent,
		5000,
	)

	//
	// ---------------------------------------------------------
	// Context
	// ---------------------------------------------------------
	//

	ctx := context.Background()

	//
	// ---------------------------------------------------------
	// Start OpenSearch bulk indexer
	// ---------------------------------------------------------
	//

	go bulkIndexer(
		ctx,
		client,
		topologyIndex,
		eventChannel,
	)

	//
	// ---------------------------------------------------------
	// Start Kafka consumer
	// ---------------------------------------------------------
	//

	log.Println(
		"🚀 Topology consumer started",
	)

	consumeKafka(
		ctx,
		reader,
		eventChannel,
	)
}