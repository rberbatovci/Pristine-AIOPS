package main

import (
	"bytes"
	"io" 
	"context"
	"encoding/json"
	"fmt"
	"log" 
	"time"

	telemetryBis "telemetry/protobuf/telemetry"

	"github.com/opensearch-project/opensearch-go"
	"github.com/segmentio/kafka-go"
	"github.com/golang/protobuf/proto"
	"github.com/opensearch-project/opensearch-go/opensearchapi"
) 

// processKafkaMessage unmarshals a Kafka message, extracts data, and indexes it into OpenSearch.
func processKafkaMessage(ctx context.Context, m kafka.Message, osClient *opensearch.Client) {
	t := new(telemetryBis.Telemetry)
	if err := proto.Unmarshal(m.Value, t); err != nil {
		log.Printf("❌ Failed to unmarshal protobuf message (Offset: %d): %v", m.Offset, err)
		// Log a snippet of the malformed message for debugging
		log.Printf("Malformed protobuf message content (first %d bytes): %x...", min(100, len(m.Value)), m.Value[:min(100, len(m.Value))])
		return
	}

	printTelemetryFields(t.DataGpbkv, "")

	device := ""
	if nodeID, ok := t.NodeId.(*telemetryBis.Telemetry_NodeIdStr); ok {
		device = nodeID.NodeIdStr
	}

	interfaceStats := telemetryFieldsToMap(t.DataGpbkv, "")

	interfaceName, _ := interfaceStats["keys.name"].(string)

	interfaceStatus, _ := interfaceStats["oper-status"].(string)

    // Save latest interface status in Redis (hash field)
    redisKey := fmt.Sprintf("telemetry:%s:interface:%s", device, interfaceName)

    if err := redisClient.HSet(ctx, redisKey, map[string]interface{}{
        "timestamp": t.MsgTimestamp,
        "status":    interfaceStatus,
    }).Err(); err != nil {
        log.Printf("❌ Failed to save interface status to Redis for %s: %v", redisKey, err)
    } else {
        log.Printf("✅ Updated Redis key %s with latest interface status", redisKey)
    }

	doc := map[string]interface{}{
		"device":        device,
		"interface":	 interfaceName,
		"collection_id": t.CollectionId,
		"timestamp": 	 t.MsgTimestamp,
		"encoding_path": t.EncodingPath,
		"ingested_at":   time.Now().UTC(),
		"status":		 interfaceStatus,
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