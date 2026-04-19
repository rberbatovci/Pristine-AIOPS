package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log" 
	"time"
	"bytes"
	"io"
	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/opensearch-project/opensearch-go"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
	"github.com/segmentio/kafka-go"
	"github.com/golang/protobuf/proto"
) 

// processKafkaMessage unmarshals a Kafka message, extracts data, and indexes it into OpenSearch.
func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
	log.Printf("RECEIVED Kafka message from topic %s, partition %d, offset %d. Message size: %d bytes",
		m.Topic, m.Partition, m.Offset, len(m.Value))

	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(m.Value, t); err != nil {
		log.Printf("❌ Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
		// Log a snippet of the malformed message for debugging
		log.Printf("Malformed protobuf message content (first %d bytes): %x...", min(100, len(m.Value)), m.Value[:min(100, len(m.Value))])
		return
	}

	log.Printf("SUCCESSFULLY Unmarshaled Protobuf. NodeID: %s, CollectionID: %d, DataGpbkv fields count: %d",
		func() string { // Anonymous function to safely get NodeIdStr
			if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
				return nodeID.NodeIdStr
			}
			return "N/A"
		}(), t.CollectionId, len(t.DataGpbkv))

	printTelemetryFields(t.DataGpbkv, "")

	device := ""
	if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
		device = nodeID.NodeIdStr
	}

	interfaceStats := telemetryFieldsToMap(t.DataGpbkv, "")

	interfaceName, _ := interfaceStats["keys.name"].(string)

    // Save latest interface statistics in Redis (hash fields)
    redisKey := fmt.Sprintf("telemetry:%s:interface:%s", device, interfaceName)

    fields := map[string]interface{}{
        "timestamp": t.MsgTimestamp,
        "rx-kbps":   interfaceStats["rx-kbps"],
        "tx-kbps":   interfaceStats["tx-kbps"],
        "rx-pps":    interfaceStats["rx-pps"],
        "tx-pps":    interfaceStats["tx-pps"],
    }

    if err := redisClient.HSet(ctx, redisKey, fields).Err(); err != nil {
        log.Printf("❌ Failed to save interface statistics to Redis for %s: %v", redisKey, err)
    } else {
        log.Printf("✅ Updated Redis key %s with latest interface statistics", redisKey)
    }

	doc := map[string]interface{}{
		"device":        device,
		"interface":	 interfaceName,
		"collection_id": t.CollectionId,
		"timestamp": 	 t.MsgTimestamp,
		"encoding_path": t.EncodingPath,
		"ingested_at":   time.Now().UTC(),
		"stats":		 interfaceStats,
	}

	data, err := json.Marshal(doc)
	if err != nil {
		log.Printf("❌ Failed to marshal document to JSON (Offset: %d): %v", m.Offset, err)
		return
	}

	log.Printf("Parsed telemetry stats for indexing (Offset: %d): %s", m.Offset, string(data))

	req := opensearchapi.IndexRequest{
		Index:   opensearchIndex,
		Body:    bytes.NewReader(data),
		Refresh: "true",
	}

	res, err := req.Do(ctx, osClient)
	if err != nil {
		log.Printf("❌ Failed to index document to OpenSearch (Offset: %d): %v", m.Offset, err)
		return
	}
	defer res.Body.Close()

	if res.IsError() {
		errorBody, _ := io.ReadAll(res.Body)
		log.Printf("❌ OpenSearch indexing error for Offset %d: %s - %s", m.Offset, res.String(), string(errorBody))
	} else {
		log.Printf("✅ Document from Offset %d indexed successfully. OpenSearch response: %s", m.Offset, res.String())
	}
}