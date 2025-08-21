#include <curl/curl.h>
#include <jansson.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <librdkafka/rdkafka.h>
#include "globals.h"

#define OPENSEARCH_URL "http://OpenSearch:9200/traps/_bulk"
#define KAFKA_TOPIC "trap-signals"

int DATA_FLUSH_SIZE = 100;
int DATA_FLUSH_INTERVAL = 1;

json_t *opensearch_events_buffer[BULK_LIMIT];
int opensearch_events_count = 0;

json_t *kafka_signals_buffer[BULK_LIMIT];
int kafka_signals_count = 0;

// OpenSearch nodes for failover
const char *OPENSEARCH_NODES[] = {
    "http://opensearch-node1:9200",
    "http://opensearch-node2:9200",
    "http://opensearch-node3:9200"
};
const int NUM_NODES = 3;

void create_traps_index() {
    CURL *curl;
    CURLcode res;
    const char *index_path = "/traps";

    const char *mapping_json =
        "{"
        "  \"settings\": {\"number_of_shards\": 1, \"number_of_replicas\": 1},"
        "  \"mappings\": {"
        "    \"properties\": {"
        "      \"timestamp\":   {\"type\": \"date\"},"
        "      \"eventId\":     {\"type\": \"keyword\"},"
        "      \"snmpTrapOid\": {\"type\": \"keyword\"},"
        "      \"sysUpTime\":   {\"type\": \"keyword\"},"
        "      \"device\":      {\"type\": \"keyword\"},"
        "      \"content\":     {\"type\": \"object\", \"dynamic\": true}"
        "    }"
        "  }"
        "}";

    curl_global_init(CURL_GLOBAL_DEFAULT);

    int success = 0;
    for (int node_idx = 0; node_idx < NUM_NODES; node_idx++) {
        char index_url[512];
        snprintf(index_url, sizeof(index_url), "%s%s", OPENSEARCH_NODES[node_idx], index_path);

        int attempt = 0;
        const int max_retries = 10;
        const int retry_delay = 5; // seconds

        while (attempt < max_retries) {
            curl = curl_easy_init();
            if (!curl) {
                fprintf(stderr, "[ERROR] CURL init failed\n");
                break;
            }

            struct curl_slist *headers = NULL;
            headers = curl_slist_append(headers, "Content-Type: application/json");

            curl_easy_setopt(curl, CURLOPT_URL, index_url);
            curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, mapping_json);

            res = curl_easy_perform(curl);

            if (res == CURLE_OK) {
                long response_code = 0;
                curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);

                if (response_code == 200 || response_code == 400) {
                    // 400 happens if index already exists
                    fprintf(stdout, "[INFO] OpenSearch index 'traps' created or already exists at %s.\n", index_url);
                    success = 1;
                    curl_easy_cleanup(curl);
                    curl_slist_free_all(headers);
                    break;
                } else {
                    fprintf(stderr, "[WARN] Attempt %d to %s failed: HTTP %ld\n",
                            attempt + 1, index_url, response_code);
                }
            } else {
                fprintf(stderr, "[WARN] Attempt %d to %s failed: %s\n",
                        attempt + 1, index_url, curl_easy_strerror(res));
            }

            curl_easy_cleanup(curl);
            curl_slist_free_all(headers);
            sleep(retry_delay);
            attempt++;
        }

        if (success) break; // stop after first successful node
    }

    curl_global_cleanup();

    if (!success) {
        fprintf(stderr, "[ERROR] Could not create 'traps' index after trying all nodes.\n");
        exit(1);
    }
}

rd_kafka_t* init_signal_producer(const char* brokers) {
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "[ERROR] Kafka producer conf failed: %s\n", errstr);
        rd_kafka_conf_destroy(conf);
        return NULL;
    }

    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to create Kafka producer: %s\n", errstr);
        return NULL;
    }

    printf("[INFO] Kafka producer initialized successfully.\n");
    return rk;
}

void load_env_config()
{
    const char *flush_size = getenv("DATA_FLUSH_SIZE");
    const char *flush_interval = getenv("DATA_FLUSH_INTERVAL");

    if (flush_size)
    {
        DATA_FLUSH_SIZE = atoi(flush_size);
    }

    if (flush_interval)
    {
        DATA_FLUSH_INTERVAL = atoi(flush_interval);
    }
}

void send_bulk_to_kafka(rd_kafka_t *signal_producer)
{
    if (!signal_producer)
    {
        printf("No kafka signal_producer\n");
        return;
    }

    //printf("[INFO] Sending %d alerts to Kafka topic '%s'\n", kafka_signals_count, KAFKA_TOPIC);

    for (int i = 0; i < kafka_signals_count; i++)
    {

        char *json_str = json_dumps(kafka_signals_buffer[i], JSON_COMPACT);
        
        if (!json_str)
        {
            //fprintf(stderr, "[ERROR] Failed to serialize JSON for bulk send (index %d)\n", i);
            json_decref(kafka_signals_buffer[i]);
            continue;
        }

        rd_kafka_resp_err_t err = rd_kafka_producev(
            signal_producer,
            RD_KAFKA_V_TOPIC(KAFKA_TOPIC),
            RD_KAFKA_V_VALUE(json_str, strlen(json_str)),
            RD_KAFKA_V_MSGFLAGS(RD_KAFKA_MSG_F_COPY),
            RD_KAFKA_V_END);

        if (err)
        {
            fprintf(stderr, "[ERROR] Kafka alert send failed (index %d): %s\n", i, rd_kafka_err2str(err));
        }

        free(json_str);
        json_decref(kafka_signals_buffer[i]);
    }

    int remaining_timeout = 1000;
    while (rd_kafka_outq_len(signal_producer) > 0 && remaining_timeout > 0)
    {
        int polled = rd_kafka_poll(signal_producer, 100);
        remaining_timeout -= 100;
    }

    if (rd_kafka_outq_len(signal_producer) > 0)
    {
        fprintf(stderr, "[WARN] %d messages still in Kafka signal_producer queue after flush timeout.\n", rd_kafka_outq_len(signal_producer));
    }

    kafka_signals_count = 0;
}

void send_bulk_to_opensearch(json_t **buffer, int count) {
    CURL *curl = curl_easy_init();
    if (!curl) {
        fprintf(stderr, "[ERROR] Failed to init CURL\n");
        return;
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/x-ndjson");

    // Build bulk payload
    size_t bulk_size = 1;
    char *bulk_payload = calloc(1, bulk_size);

    for (int i = 0; i < count; i++) {
        const char *event_id = json_string_value(json_object_get(buffer[i], "eventId"));
        if (!event_id) {
            fprintf(stderr, "[WARN] Missing eventId in buffer[%d], using index only\n", i);
        }

        char *json_str = json_dumps(buffer[i], JSON_COMPACT);
        if (!json_str) continue;

        char action_line[512];
        if (event_id) {
            snprintf(action_line, sizeof(action_line),
                     "{ \"index\": { \"_index\": \"traps\", \"_id\": \"%s\" } }\n", event_id);
        } else {
            // no _id -> let OpenSearch auto-generate
            snprintf(action_line, sizeof(action_line),
                     "{ \"index\": { \"_index\": \"traps\" } }\n");
        }

        size_t additional_size = strlen(action_line) + strlen(json_str) + 2;
        bulk_payload = realloc(bulk_payload, bulk_size + additional_size);
        if (!bulk_payload) {
            fprintf(stderr, "[ERROR] Failed to realloc payload\n");
            free(json_str);
            break;
        }

        strcat(bulk_payload, action_line);
        strcat(bulk_payload, json_str);
        strcat(bulk_payload, "\n");

        bulk_size += additional_size;
        free(json_str);
    }

    int success = 0;
    const int max_retries = 3;
    const int retry_delay = 3;

    for (int node_idx = 0; node_idx < NUM_NODES && !success; node_idx++) {
        char bulk_url[512];
        snprintf(bulk_url, sizeof(bulk_url), "%s/traps/_bulk", OPENSEARCH_NODES[node_idx]);

        for (int attempt = 0; attempt < max_retries; attempt++) {
            curl_easy_setopt(curl, CURLOPT_URL, bulk_url);
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_payload);

            // ❌ no auth, no SSL

            CURLcode res = curl_easy_perform(curl);
            if (res == CURLE_OK) {
                fprintf(stdout, "[INFO] Successfully sent %d traps to OpenSearch node %s.\n", count, OPENSEARCH_NODES[node_idx]);
                success = 1;
                break;
            } else {
                fprintf(stderr, "[WARN] Attempt %d to node %s failed: %s\n",
                        attempt + 1, OPENSEARCH_NODES[node_idx], curl_easy_strerror(res));
                sleep(retry_delay);
            }
        }
    }

    if (!success) {
        fprintf(stderr, "[ERROR] Failed to send traps bulk data after trying all nodes.\n");
    }

    free(bulk_payload);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
}


void add_alert_to_kafka_bulk(json_t *alert_json, rd_kafka_t *signal_producer)
{
    if (!signal_producer || !alert_json) { return; }

    json_t *copied_alert = json_deep_copy(alert_json);
    if (!copied_alert)
    {
        fprintf(stderr, "[ERROR] Failed to deep copy JSON for Kafka bulk buffer.\n");
        json_decref(alert_json);
        return;
    }

    if (kafka_signals_count < DATA_FLUSH_SIZE)
    {
        kafka_signals_buffer[kafka_signals_count++] = copied_alert;
        printf("[INFO] Added alert to Kafka buffer. Current count: %d\n", kafka_signals_count);

        if (kafka_signals_count >= DATA_FLUSH_SIZE)
        {
            printf("[INFO] Kafka alert buffer full. Sending bulk...\n");
            send_bulk_to_kafka(signal_producer);
        }
    }
    else
    {
        fprintf(stderr, "[WARN] Kafka buffer is unexpectedly full. Forcing flush and adding new alert.\n");
        send_bulk_to_kafka(signal_producer);
        kafka_signals_buffer[kafka_signals_count++] = copied_alert;
    }
}