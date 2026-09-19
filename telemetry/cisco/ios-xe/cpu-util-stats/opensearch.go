package main

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "time"

    "github.com/opensearch-project/opensearch-go"
    "github.com/opensearch-project/opensearch-go/opensearchapi"
)

//
// ==========================
// OpenSearch Setup
// ==========================
// 
func createIndex(client *opensearch.Client, index string) error {
    existsReq := opensearchapi.IndicesExistsRequest{
        Index: []string{index},
    }

    res, err := existsReq.Do(context.Background(), client)
    if err != nil {
        return fmt.Errorf("failed to check index: %w", err)
    }
    defer res.Body.Close()

    if res.StatusCode == 200 {
        log.Printf("ℹ️ Index [%s] already exists", index)
        return nil
    }

    if res.StatusCode != 404 {
        body, _ := io.ReadAll(res.Body)
        return fmt.Errorf("unexpected response: %s", string(body))
    }

    // Index mapping
    indexSettings := map[string]interface{}{
        "settings": map[string]interface{}{
            "number_of_shards":   1,
            "number_of_replicas": 1,
        },
        "mappings": map[string]interface{}{
            "properties": map[string]interface{}{
                "device":       map[string]interface{}{"type": "keyword"},
                "timestamp":    map[string]interface{}{"type": "date"},
                "ingested_at":  map[string]interface{}{"type": "date"},
                "stats":        map[string]interface{}{"type": "object"},
            },
        },
    }

    body, err := json.Marshal(indexSettings)
	if err != nil {
		return fmt.Errorf("failed to marshal memory index settings: %w", err)
	}

    createReq := opensearchapi.IndicesCreateRequest{
        Index: index,
        Body:  bytes.NewReader(body),
    }

    res, err = createReq.Do(context.Background(), client)
    if err != nil {
        return err
    }
    defer res.Body.Close()

    if res.IsError() {
        body, _ := io.ReadAll(res.Body)
        return fmt.Errorf("create index error: %s", string(body))
    }

    log.Printf("✅ Created index: %s", index)
    return nil
}

//
// ==========================
// OpenSearch Client
// ==========================
//

func setupOpenSearchClient() (*opensearch.Client, error) {
    client, err := opensearch.NewClient(opensearch.Config{
        Addresses: []string{
            opensearch1,
            opensearch2,
            opensearch3,
        },
        RetryOnStatus: []int{502, 503, 504, 429},
        MaxRetries:    5,
    })
    if err != nil {
        return nil, err
    }

    res, err := client.Info()
    if err != nil {
        return nil, err
    }
    defer res.Body.Close()

    if res.IsError() {
        body, _ := io.ReadAll(res.Body)
        return nil, fmt.Errorf("OpenSearch error: %s", string(body))
    }

    log.Println("✅ Connected to OpenSearch")

    if err := createIndex(client, telemetryTopic); err != nil {
        return nil, err
    }

    return client, nil
}
 
//
// ==========================
// Bulk Flush (NO GLOBALS)
// ==========================
//

func flushBulk(
    ctx context.Context,
    client *opensearch.Client,
    index string,
    docs []TelemetryMessage,
) {
    var bulkBody bytes.Buffer

    for _, msg := range docs {
        meta := fmt.Sprintf(`{ "index": { "_index": "%s" } }%s`, index, "\n")
        bulkBody.WriteString(meta)

        doc := map[string]interface{}{
            "device":      msg.Device,
            "timestamp":   msg.Timestamp,
            "stats":       msg.Stats,
            "ingested_at": time.Now().UTC(),
        }

        data, err := json.Marshal(doc)
        if err != nil {
            log.Printf("❌ marshal error: %v", err)
            continue
        }

        bulkBody.Write(data)
        bulkBody.WriteString("\n")
    }

    req := opensearchapi.BulkRequest{
        Body: bytes.NewReader(bulkBody.Bytes()),
    }

    res, err := req.Do(ctx, client)
    if err != nil {
        log.Printf("❌ bulk request failed: %v", err)
        return
    }
    defer res.Body.Close()

    if res.IsError() {
        body, _ := io.ReadAll(res.Body)
        log.Printf("❌ bulk error: %s", string(body))
        return
    }

    //log.Printf("✅ Indexed %d documents", len(docs))
}

/*
========================================================
BULK INDEXER
========================================================
*/

func bulkIndexer(ctx context.Context, client *opensearch.Client, in <-chan TelemetryMessage) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	buffer := make([]TelemetryMessage, 0, 1000)

	for {
		select {
		case msg := <-in:
			buffer = append(buffer, msg)

			if len(buffer) >= 1000 {
				flushBulk(ctx, client, telemetryTopic, buffer)
				buffer = buffer[:0]
			}

		case <-ticker.C:
			if len(buffer) > 0 {
				flushBulk(ctx, client, telemetryTopic, buffer)
				buffer = buffer[:0]
			}
		}
	}
}