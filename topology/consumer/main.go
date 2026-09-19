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
// Kafka Topology Event
// ============================================================
//
//
// This represents the COMPLETE event coming from Kafka.
//
// We keep Path here temporarily so we can extract the
// fields we actually want before writing to OpenSearch.
//

type TopologyEvent struct {
	ID         string          `json:"id"`
	Timestamp  string          `json:"timestamp"`
	EventType  string          `json:"event_type"`
	IsWithdraw bool            `json:"is_withdraw"`
	NLRIType   string          `json:"nlri_type,omitempty"`
	Path       json.RawMessage `json:"path"`
}

//
// ============================================================
// Normalized OpenSearch Event
// ============================================================
//
//
// This is the simplified document stored in OpenSearch.
//

type NormalizedTopologyEvent struct {
	EventID string `json:"event_id"`

	Timestamp  string    `json:"timestamp"`
	IngestedAt time.Time `json:"ingested_at"`

	EventType  string `json:"event_type"`
	IsWithdraw bool   `json:"is_withdraw"`

	//
	// BGP-LS identity
	//

	NLRIType    string `json:"nlri_type"`
	TopologyKey string `json:"topology_key,omitempty"`

	Protocol      string `json:"protocol,omitempty"`
	ProtocolLevel string `json:"protocol_level,omitempty"`

	//
	// BGP source
	//

	SourceIP   string `json:"source_ip,omitempty"`
	SourceASN  uint32 `json:"source_asn,omitempty"`
	NeighborIP string `json:"neighbor_ip,omitempty"`

	//
	// Local node
	//

	LocalRouterID   string `json:"local_router_id,omitempty"`
	LocalASN        uint32 `json:"local_asn,omitempty"`
	LocalPseudonode bool   `json:"local_pseudonode,omitempty"`

	//
	// Remote node
	//

	RemoteRouterID   string `json:"remote_router_id,omitempty"`
	RemoteASN        uint32 `json:"remote_asn,omitempty"`
	RemotePseudonode bool   `json:"remote_pseudonode,omitempty"`

	//
	// Node information
	//

	NodeName string `json:"node_name,omitempty"`
	ISISArea string `json:"isis_area,omitempty"`

	//
	// Link information
	//

	LinkMetric *uint32 `json:"link_metric,omitempty"`

	//
	// Prefix information
	//

	Prefix string `json:"prefix,omitempty"`

	//
	// BGP attributes
	//

	NextHop   string  `json:"next_hop,omitempty"`
	LocalPref *uint32 `json:"local_pref,omitempty"`
}

//
// ============================================================
// Raw BGP-LS structures
// ============================================================
//

type rawPath struct {
	NLRI rawNLRI `json:"nlri"`

	Pattrs []json.RawMessage `json:"pattrs"`

	Age string `json:"age"`

	Validation interface{} `json:"validation"`

	Family struct {
		AFI  string `json:"afi"`
		SAFI string `json:"safi"`
	} `json:"family"`

	SourceASN  uint32 `json:"sourceAsn"`
	SourceID   string `json:"sourceId"`
	NeighborIP string `json:"neighborIp"`

	LocalIdentifier int `json:"localIdentifier"`
}

//
// ============================================================
// Prefix Descriptor
// ============================================================
//

type rawPrefixDescriptor struct {
    IPReachability json.RawMessage `json:"ipReachability"`
}

//
// ============================================================
// NLRI
// ============================================================
//

type rawNLRI struct {
	Type string `json:"type"`

	NLRI struct {
		Type string `json:"@type"`

		LocalNode  *rawNode `json:"localNode"`
		RemoteNode *rawNode `json:"remoteNode"`

		LinkDescriptor interface{} `json:"linkDescriptor"`

		PrefixDescriptor *rawPrefixDescriptor `json:"prefixDescriptor"`
	} `json:"nlri"`

	Length     int    `json:"length"`
	ProtocolID string `json:"protocolId"`
}

//
// ============================================================
// Node
// ============================================================
//

type rawNode struct {
	ASN         uint32 `json:"asn"`
	IGPRouterID string `json:"igpRouterId"`
	BGPRouterID string `json:"bgpRouterId"`
	Pseudonode  bool   `json:"pseudonode"`
}

//
// ============================================================
// Environment helper
// ============================================================
//

func getEnv(
	key string,
	defaultValue string,
) string {

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
	// Index already exists
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
	// Index settings + mapping
	//

	indexSettings := map[string]interface{}{

		"settings": map[string]interface{}{

			"number_of_shards": 1,

			"number_of_replicas": 1,
		},

		"mappings": map[string]interface{}{

			"properties": map[string]interface{}{

				//
				// ------------------------------------------------
				// Event
				// ------------------------------------------------
				//

				"event_id": map[string]interface{}{
					"type": "keyword",
				},

				"timestamp": map[string]interface{}{
					"type": "date",
				},

				"ingested_at": map[string]interface{}{
					"type": "date",
				},

				"event_type": map[string]interface{}{
					"type": "keyword",
				},

				"is_withdraw": map[string]interface{}{
					"type": "boolean",
				},

				//
				// ------------------------------------------------
				// BGP-LS
				// ------------------------------------------------
				//

				"nlri_type": map[string]interface{}{
					"type": "keyword",
				},

				"topology_key": map[string]interface{}{
					"type": "keyword",
				},

				"protocol": map[string]interface{}{
					"type": "keyword",
				},

				"protocol_level": map[string]interface{}{
					"type": "keyword",
				},

				//
				// ------------------------------------------------
				// Source
				// ------------------------------------------------
				//

				"source_ip": map[string]interface{}{
					"type": "ip",
				},

				"source_asn": map[string]interface{}{
					"type": "integer",
				},

				"neighbor_ip": map[string]interface{}{
					"type": "ip",
				},

				//
				// ------------------------------------------------
				// Local node
				// ------------------------------------------------
				//

				"local_router_id": map[string]interface{}{
					"type": "keyword",
				},

				"local_asn": map[string]interface{}{
					"type": "integer",
				},

				"local_pseudonode": map[string]interface{}{
					"type": "boolean",
				},

				//
				// ------------------------------------------------
				// Remote node
				// ------------------------------------------------
				//

				"remote_router_id": map[string]interface{}{
					"type": "keyword",
				},

				"remote_asn": map[string]interface{}{
					"type": "integer",
				},

				"remote_pseudonode": map[string]interface{}{
					"type": "boolean",
				},

				//
				// ------------------------------------------------
				// Node information
				// ------------------------------------------------
				//

				"node_name": map[string]interface{}{
					"type": "keyword",
				},

				"isis_area": map[string]interface{}{
					"type": "keyword",
				},

				//
				// ------------------------------------------------
				// Link
				// ------------------------------------------------
				//

				"link_metric": map[string]interface{}{
					"type": "integer",
				},

				//
				// ------------------------------------------------
				// Prefix
				// ------------------------------------------------
				//

				"prefix": map[string]interface{}{
					"type": "keyword",
				},

				//
				// ------------------------------------------------
				// BGP attributes
				// ------------------------------------------------
				//

				"next_hop": map[string]interface{}{
					"type": "ip",
				},

				"local_pref": map[string]interface{}{
					"type": "integer",
				},
			},
		},
	}

	body, err := json.Marshal(
		indexSettings,
	)

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
// Normalize NLRI Type
// ============================================================
//

func normalizeNLRIType(
	value string,
) string {

	switch value {

	case "LS_NLRI_NODE":

		return "NODE"

	case "LS_NLRI_LINK":

		return "LINK"

	case "LS_NLRI_PREFIX_V4",
		"LS_NLRI_PREFIX_V6",
		"LS_NLRI_PREFIX_IPV4",
		"LS_NLRI_PREFIX_IPV6":

		return "PREFIX"

	default:

		return value
	}
}

//
// ============================================================
// Normalize Protocol
// ============================================================
//

func normalizeProtocol(
	value string,
) string {

	switch {

	case strings.Contains(
		value,
		"ISIS",
	):

		return "ISIS"

	case strings.Contains(
		value,
		"OSPF",
	):

		return "OSPF"

	default:

		return value
	}
}

//
// ============================================================
// Normalize Protocol Level
// ============================================================
//

func normalizeProtocolLevel(
	value string,
) string {

	switch {

	case strings.Contains(
		value,
		"_L1",
	):

		return "L1"

	case strings.Contains(
		value,
		"_L2",
	):

		return "L2"

	default:

		return ""
	}
}

//
// ============================================================
// Extract Prefix
// ============================================================
//

func extractPrefix(path rawPath) string {

    descriptor := path.NLRI.NLRI.PrefixDescriptor

    if descriptor == nil || len(descriptor.IPReachability) == 0 {
        return ""
    }

    raw := bytes.TrimSpace(descriptor.IPReachability)

    // ---------------------------------------------
    // Case 1: string
    // ---------------------------------------------

    var prefix string

    if err := json.Unmarshal(raw, &prefix); err == nil {
        return prefix
    }

    // ---------------------------------------------
    // Case 2: array
    // ---------------------------------------------

    var prefixes []string

    if err := json.Unmarshal(raw, &prefixes); err == nil {

        if len(prefixes) == 0 {
            return ""
        }

        // Usually one prefix is associated with
        // one BGP-LS Prefix NLRI.
        return strings.Join(prefixes, ",")
    }

    // ---------------------------------------------
    // Case 3: unknown structure
    // ---------------------------------------------

    return string(raw)
}

//
// ============================================================
// Build Topology Key
// ============================================================
//
//
//
// NODE:
//
//   NODE:<router-id>
//
// Example:
//
//   NODE:1921.6800.1194
//
// LINK:
//
//   LINK:<local-router>:<remote-router>
//
// Example:
//
//   LINK:1921.6800.1194-01:1921.6800.1195
//
// PREFIX:
//
//   PREFIX:<router>:<prefix>
//
// Example:
//
//   PREFIX:1921.6800.1194:10.10.10.0/24
//
// This key gives us a stable identifier for the topology
// object represented by the BGP-LS event.
//

func buildTopologyKey(
	nlriType string,
	localRouterID string,
	remoteRouterID string,
	prefix string,
) string {

	switch nlriType {

	case "NODE":

		if localRouterID == "" {
			return ""
		}

		return fmt.Sprintf(
			"NODE:%s",
			localRouterID,
		)

	case "LINK":

		if localRouterID == "" ||
			remoteRouterID == "" {

			return ""
		}

		return fmt.Sprintf(
			"LINK:%s:%s",
			localRouterID,
			remoteRouterID,
		)

	case "PREFIX":

		if localRouterID == "" ||
			prefix == "" {

			return ""
		}

		return fmt.Sprintf(
			"PREFIX:%s:%s",
			localRouterID,
			prefix,
		)

	default:

		return ""
	}
}

//
// ============================================================
// Parse BGP-LS PATTRs
// ============================================================
//

func parsePattrs(
	rawPattrs []json.RawMessage,
) (
	nodeName string,
	isisArea string,
	linkMetric *uint32,
	localPref *uint32,
	nextHop string,
) {

	for _, item := range rawPattrs {

		var header struct {
			Type string `json:"@type"`
		}

		if err := json.Unmarshal(
			item,
			&header,
		); err != nil {

			continue
		}

		//
		// --------------------------------------------------------
		// BGP-LS Attribute
		// --------------------------------------------------------
		//

		if strings.Contains(
			header.Type,
			"LsAttribute",
		) {

			var ls struct {

				Node struct {
					Name     string `json:"name"`
					ISISArea string `json:"isisArea"`
				} `json:"node"`

				Link struct {
					IGPMetric *uint32 `json:"igpMetric"`
				} `json:"link"`

				Prefix struct {
					IPReachability string `json:"ipReachability"`
				} `json:"prefix"`
			}

			if err := json.Unmarshal(
				item,
				&ls,
			); err != nil {

				continue
			}

			nodeName = ls.Node.Name

			isisArea = ls.Node.ISISArea

			linkMetric = ls.Link.IGPMetric
		}

		//
		// --------------------------------------------------------
		// Local Preference
		// --------------------------------------------------------
		//

		if strings.Contains(
			header.Type,
			"LocalPrefAttribute",
		) {

			var lp struct {
				LocalPref *uint32 `json:"localPref"`
			}

			if err := json.Unmarshal(
				item,
				&lp,
			); err != nil {

				continue
			}

			localPref = lp.LocalPref
		}

		//
		// --------------------------------------------------------
		// MP_REACH_NLRI
		// --------------------------------------------------------
		//

		if strings.Contains(
			header.Type,
			"MpReachNLRIAttribute",
		) {

			var mp struct {
				NextHops []string `json:"nextHops"`
			}

			if err := json.Unmarshal(
				item,
				&mp,
			); err != nil {

				continue
			}

			if len(mp.NextHops) > 0 {

				nextHop = mp.NextHops[0]
			}
		}
	}

	return
}

//
// ============================================================
// Normalize Topology Event
// ============================================================
//

func normalizeTopologyEvent(
    event TopologyEvent,
) (NormalizedTopologyEvent, error) {

    var path rawPath

    if err := json.Unmarshal(
        event.Path,
        &path,
    ); err != nil {

        return NormalizedTopologyEvent{}, fmt.Errorf(
            "failed to parse path: %w",
            err,
        )
    }

    result := NormalizedTopologyEvent{

        EventID: event.ID,

        Timestamp:  event.Timestamp,
        IngestedAt: time.Now().UTC(),

        EventType:  event.EventType,
        IsWithdraw: event.IsWithdraw,

        NLRIType: normalizeNLRIType(
            event.NLRIType,
        ),

        SourceIP: path.SourceID,

        SourceASN: path.SourceASN,

        NeighborIP: path.NeighborIP,
    }

    // --------------------------------------------------------
    // Protocol
    // --------------------------------------------------------

    result.Protocol = normalizeProtocol(
        path.NLRI.ProtocolID,
    )

    result.ProtocolLevel = normalizeProtocolLevel(
        path.NLRI.ProtocolID,
    )

    // --------------------------------------------------------
    // Local node
    // --------------------------------------------------------

    if path.NLRI.NLRI.LocalNode != nil {

        node := path.NLRI.NLRI.LocalNode

        result.LocalRouterID = node.IGPRouterID

        result.LocalASN = node.ASN

        result.LocalPseudonode = node.Pseudonode
    }

    // --------------------------------------------------------
    // Remote node
    // --------------------------------------------------------

    if path.NLRI.NLRI.RemoteNode != nil {

        node := path.NLRI.NLRI.RemoteNode

        result.RemoteRouterID = node.IGPRouterID

        result.RemoteASN = node.ASN

        result.RemotePseudonode = node.Pseudonode
    }

    // --------------------------------------------------------
    // BGP-LS attributes
    // --------------------------------------------------------

    nodeName,
    isisArea,
    linkMetric,
    localPref,
    nextHop := parsePattrs(
        path.Pattrs,
    )

    result.NodeName = nodeName

    result.ISISArea = isisArea

    result.LinkMetric = linkMetric

    result.LocalPref = localPref

    result.NextHop = nextHop

    // --------------------------------------------------------
    // Prefix
    // --------------------------------------------------------

    result.Prefix = extractPrefix(path)

    // --------------------------------------------------------
    // Topology key
    // --------------------------------------------------------

    result.TopologyKey = buildTopologyKey(
        result.NLRIType,
        result.LocalRouterID,
        result.RemoteRouterID,
        result.Prefix,
    )

    return result, nil
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
		// --------------------------------------------------------
		// Normalize event FIRST
		// --------------------------------------------------------
		//

		normalized, err := normalizeTopologyEvent(
			msg,
		)

		if err != nil {

			log.Printf(
				"❌ Failed to normalize event %s: %v",
				msg.ID,
				err,
			)

			continue
		}

		//
		// --------------------------------------------------------
		// Bulk metadata
		// --------------------------------------------------------
		//

		meta := fmt.Sprintf(
			`{ "index": { "_index": "%s" } }`,
			index,
		)

		bulkBody.WriteString(meta)

		bulkBody.WriteByte('\n')

		//
		// --------------------------------------------------------
		// Serialize normalized document
		// --------------------------------------------------------
		//

		data, err := json.Marshal(
			normalized,
		)

		if err != nil {

			log.Printf(
				"❌ Failed to marshal normalized event %s: %v",
				msg.ID,
				err,
			)

			continue
		}

		bulkBody.Write(data)

		bulkBody.WriteByte('\n')
	}

	//
	// Nothing to send
	//

	if bulkBody.Len() == 0 {
		return
	}

	//
	// ----------------------------------------------------------
	// Bulk request
	// ----------------------------------------------------------
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
	// HTTP error
	//

	if res.IsError() {

		body, _ := io.ReadAll(
			res.Body,
		)

		log.Printf(
			"❌ OpenSearch bulk error: %s",
			string(body),
		)

		return
	}

	//
	// ----------------------------------------------------------
	// Parse bulk response
	// ----------------------------------------------------------
	//

	var bulkResponse struct {

		Errors bool `json:"errors"`

		Items []map[string]struct {
			Status int         `json:"status"`
			Error  interface{} `json:"error,omitempty"`
		} `json:"index"`
	}

	body, err := io.ReadAll(
		res.Body,
	)

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

	//
	// ----------------------------------------------------------
	// Individual document failures
	// ----------------------------------------------------------
	//

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
		// --------------------------------------------------------
		// New Kafka event
		// --------------------------------------------------------
		//

		case msg, ok := <-in:

			if !ok {

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
		// --------------------------------------------------------
		// One second elapsed
		// --------------------------------------------------------
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

		msg, err := reader.ReadMessage(
			ctx,
		)

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
	// ---------------------------------------------------------
	// Create index
	// ---------------------------------------------------------
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

			MinBytes: 1,

			MaxBytes: 10e6,

			MaxWait: 500 * time.Millisecond,

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