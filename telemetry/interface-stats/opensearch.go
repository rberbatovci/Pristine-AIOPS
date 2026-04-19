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
    return client, nil
}


func createIndexIfNotExists(client *opensearch.Client, indexName string) error {
	// Check if index exists
	existsReq := opensearchapi.IndicesExistsRequest{
		Index: []string{indexName},
	}
	res, err := existsReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to check if index exists: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode == 200 {
		log.Printf("ℹ Index [%s] already exists", indexName)
		return nil
	}

	if res.StatusCode != 404 {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("unexpected response checking index: %s", string(body))
	}

	// Define index settings and mappings
	indexSettings := map[string]interface{}{
		"settings": map[string]interface{}{
			"number_of_shards":   1,
			"number_of_replicas": 1,
		},
		"mappings": map[string]interface{}{
			"properties": map[string]interface{}{
				"device":        map[string]interface{}{"type": "keyword"},
				"interface":     map[string]interface{}{"type": "keyword"},
				"subscription":  map[string]interface{}{"type": "object"}, // can expand if you want nested
				"collection_id": map[string]interface{}{"type": "long"},
				"timestamp": map[string]interface{}{"type": "date"},
				"encoding_path": map[string]interface{}{"type": "keyword"},
				"ingested_at":   map[string]interface{}{"type": "date"},

				"stats": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"discontinuity-time": map[string]interface{}{"type": "date"},
						"keys.name":          map[string]interface{}{"type": "keyword"},

						// Counters (numeric fields)
						"in-broadcast-pkts":   map[string]interface{}{"type": "long"},
						"in-crc-errors":       map[string]interface{}{"type": "long"},
						"in-discards":         map[string]interface{}{"type": "long"},
						"in-discards-64":      map[string]interface{}{"type": "long"},
						"in-errors":           map[string]interface{}{"type": "long"},
						"in-errors-64":        map[string]interface{}{"type": "long"},
						"in-multicast-pkts":   map[string]interface{}{"type": "long"},
						"in-octets":           map[string]interface{}{"type": "long"},
						"in-unicast-pkts":     map[string]interface{}{"type": "long"},
						"in-unknown-protos":   map[string]interface{}{"type": "long"},
						"in-unknown-protos-64": map[string]interface{}{"type": "long"},
						"num-flaps":           map[string]interface{}{"type": "long"},
						"out-broadcast-pkts":  map[string]interface{}{"type": "long"},
						"out-discards":        map[string]interface{}{"type": "long"},
						"out-errors":          map[string]interface{}{"type": "long"},
						"out-multicast-pkts":  map[string]interface{}{"type": "long"},
						"out-octets":          map[string]interface{}{"type": "long"},
						"out-octets-64":       map[string]interface{}{"type": "long"},
						"out-unicast-pkts":    map[string]interface{}{"type": "long"},

						// Rates (use float)
						"rx-kbps": map[string]interface{}{"type": "float"},
						"rx-pps":  map[string]interface{}{"type": "float"},
						"tx-kbps": map[string]interface{}{"type": "float"},
						"tx-pps":  map[string]interface{}{"type": "float"},
					},
				},
			},
		},
	}

	body, err := json.Marshal(indexSettings)
	if err != nil {
		return fmt.Errorf("failed to marshal index settings: %w", err)
	}

	// Create index
	createReq := opensearchapi.IndicesCreateRequest{
		Index: indexName,
		Body:  bytes.NewReader(body),
	}

	res, err = createReq.Do(context.Background(), client)
	if err != nil {
		return fmt.Errorf("failed to create index: %w", err)
	}
	defer res.Body.Close()

	if res.IsError() {
		body, _ := io.ReadAll(res.Body)
		return fmt.Errorf("error creating index: %s", string(body))
	}

	log.Printf("✅ Created OpenSearch index: %s", indexName)
	return nil
}