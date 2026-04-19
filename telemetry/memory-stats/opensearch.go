package main

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"

    "github.com/opensearch-project/opensearch-go"
    "github.com/opensearch-project/opensearch-go/opensearchapi"
)


func flushBulkToOpenSearch(ctx context.Context, osClient *opensearch.Client, index string) error {
    bulkBufferLock.Lock()
    defer bulkBufferLock.Unlock()

    if len(bulkBuffer) == 0 {
        return nil // nothing to do
    }

    var bulkBody bytes.Buffer
    for _, doc := range bulkBuffer {
        // Add metadata line for bulk API
        meta := fmt.Sprintf(`{ "index": { "_index": "%s" } }%s`, index, "\n")
        bulkBody.WriteString(meta)

        // Add document JSON line
        data, err := json.Marshal(doc)
        if err != nil {
            // skip bad docs but log error
            log.Printf("Failed to marshal doc for bulk indexing: %v", err)
            continue
        }
        bulkBody.Write(data)
        bulkBody.WriteString("\n")
    }

    // Clear buffer since we copied data to bulkBody
    bulkBuffer = nil

    req := opensearchapi.BulkRequest{
        Body:    bytes.NewReader(bulkBody.Bytes()),
        Refresh: "true", // optional, can remove for performance
    }

    res, err := req.Do(ctx, osClient)
    if err != nil {
        return fmt.Errorf("bulk request failed: %w", err)
    }
    defer res.Body.Close()

    body, _ := io.ReadAll(res.Body)
	//log.Printf(" Bulk response: %s", body)

	if res.IsError() {
    	return fmt.Errorf("bulk request error: %s - %s", res.String(), string(body))
	}

    log.Printf(" Bulk indexed %d documents to OpenSearch", len(bulkBuffer))
    return nil
}

func setupOpenSearchClient() (*opensearch.Client, error) {
    client, err := opensearch.NewClient(opensearch.Config{
        Addresses: []string{
            opensearch1,
            opensearch2,
            opensearch3,
        },
        // Optional: set retry behavior
        RetryOnStatus: []int{502, 503, 504, 429},
        MaxRetries:    5,
    })
    if err != nil {
        return nil, err
    }

    // Check connection
    res, err := client.Info()
    if err != nil {
        return nil, err
    }
    defer res.Body.Close()

    if res.IsError() {
        bodyBytes, _ := io.ReadAll(res.Body)
        return nil, fmt.Errorf("OpenSearch connection error: %s - %s", res.Status(), string(bodyBytes))
    }

    bodyBytes, err := io.ReadAll(res.Body)
    if err != nil {
        return nil, err
    }

    var info map[string]interface{}
    if err := json.Unmarshal(bodyBytes, &info); err != nil {
        return nil, err
    }

    version := "unknown"
    if vMap, ok := info["version"].(map[string]interface{}); ok {
        if vStr, ok := vMap["number"].(string); ok {
            version = vStr
        }
    }

    log.Printf("Connected to OpenSearch cluster version: %s", version)

    if err := createMemoryIndexIfNotExists(client, opensearchIndex); err != nil {
        return nil, fmt.Errorf("failed to ensure index exists: %w", err)
    }

    return client, nil
}

func createMemoryIndexIfNotExists(client *opensearch.Client, opensearchIndex string) error {
	// Check if index exists
	existsReq := opensearchapi.IndicesExistsRequest{
		Index: []string{opensearchIndex},
	}
	res, err := existsReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to check if memory index exists: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		log.Printf("ℹ️ Index [%s] already exists", opensearchIndex)
		return nil
	}

	if res.StatusCode != 404 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("unexpected response checking memory index: %s", string(body))
	}

	// Define index settings/mappings
	indexSettings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"device":          map[string]interface{}{"type": "keyword"},
				"collection_id":   map[string]interface{}{"type": "long"},
				"timestamp":   map[string]interface{}{"type": "date"},
				"encoding_path":   map[string]interface{}{"type": "keyword"},
				"ingested_at":     map[string]interface{}{"type": "date"},
				"memory":          map[string]interface{}{"type": "keyword"}, // assuming memoryKey is string
				"stats": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"total-memory":   map[string]interface{}{"type": "float"},
						"used-memory":    map[string]interface{}{"type": "float"},
						"free-memory":    map[string]interface{}{"type": "float"},
						"lowest-usage":   map[string]interface{}{"type": "float"},
						"highest-usage":  map[string]interface{}{"type": "float"},
					},
				},
			},
		},
	}

	body, err := json.Marshal(indexSettings)
	if err != nil {
		return fmt.Errorf("failed to marshal memory index settings: %w", err)
	}

	createReq := opensearchapi.IndicesCreateRequest{
		Index: opensearchIndex,
		Body:  bytes.NewReader(body),
	}

	res, err = createReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to create memory index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("error creating memory index: %s", string(body))
	}

	log.Printf("✅ Created OpenSearch memory index: %s", opensearchIndex)
	return nil
}