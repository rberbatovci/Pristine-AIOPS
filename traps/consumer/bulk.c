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

void create_traps_index() {
    CURL *curl;
    CURLcode res;

    const char *index_url = "http://opensearch:9200/traps";
    const char *mapping_json =
        "{"
        "  \"settings\": {"
        "    \"number_of_shards\": 1,"
        "    \"number_of_replicas\": 1"
        "  },"
        "  \"mappings\": {"
        "    \"properties\": {"
        "      \"timestamp\":       {\"type\": \"date\"},"
        "      \"eventId\":         {\"type\": \"keyword\"},"
        "      \"snmpTrapOid\":     {\"type\": \"keyword\"},"
        "      \"sysUpTime\":       {\"type\": \"keyword\"},"
        "      \"device\":          {\"type\": \"keyword\"},"
        "      \"content\":         {\"type\": \"object\", \"enabled\": true}"
        "    }"
        "  }"
        "}";

    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();

    if (curl) {
        struct curl_slist *headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");

        curl_easy_setopt(curl, CURLOPT_URL, index_url);
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, mapping_json);

        res = curl_easy_perform(curl);

        if (res != CURLE_OK) {
            fprintf(stderr, "[ERROR] Failed to create 'traps' index: %s\n", curl_easy_strerror(res));
        } else {
            fprintf(stdout, "[INFO] OpenSearch index 'traps' created or already exists.\n");
        }

        curl_easy_cleanup(curl);
        curl_slist_free_all(headers);
    }

    curl_global_cleanup();
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
            fprintf(stderr, "[ERROR] Failed to serialize JSON for bulk send (index %d)\n", i);
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

void send_bulk_to_opensearch(json_t **docs, int doc_count)
{
    CURL *curl;
    CURLcode res;
    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();

    if (!curl) {
        fprintf(stderr, "[ERROR] Failed to initialize CURL\n");
        return;
    }

    char *bulk_data = NULL;
    size_t total_len = 0;

    for (int i = 0; i < doc_count; i++) {
        const char *event_id = json_string_value(json_object_get(docs[i], "eventId"));
        if (!event_id) {
            fprintf(stderr, "[ERROR] Missing eventId in document %d\n", i);
            continue; // skip this doc
        }

        // Create metadata line with index name and _id
        char meta_line[512];
        snprintf(meta_line, sizeof(meta_line),
                 "{\"index\":{\"_index\":\"traps\",\"_id\":\"%s\"}}\n", event_id);

        char *json_str = json_dumps(docs[i], JSON_COMPACT);
        size_t meta_len = strlen(meta_line);
        size_t json_len = strlen(json_str);
        size_t line_len = meta_len + json_len + 1; // \n

        bulk_data = realloc(bulk_data, total_len + line_len + 1);
        if (!bulk_data) {
            fprintf(stderr, "[ERROR] Memory allocation failed\n");
            free(json_str);
            return;
        }

        snprintf(bulk_data + total_len, line_len + 1, "%s%s\n", meta_line, json_str);
        total_len += line_len;

        free(json_str);
    }

    if (total_len == 0 || !bulk_data) {
        fprintf(stderr, "[WARN] No bulk data constructed. Skipping OpenSearch request.\n");
        curl_easy_cleanup(curl);
        curl_global_cleanup();
        return;
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/x-ndjson");

    // ✅ Correct bulk URL with index
    curl_easy_setopt(curl, CURLOPT_URL, "http://opensearch:9200/_bulk");
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_data);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        fprintf(stderr, "[ERROR] CURL request failed: %s\n", curl_easy_strerror(res));
    } else {
        fprintf(stdout, "[INFO] Bulk data successfully sent to OpenSearch\n");
    }

    curl_easy_cleanup(curl);
    curl_slist_free_all(headers);
    free(bulk_data);
    curl_global_cleanup();
}


void add_alert_to_kafka_bulk(json_t *alert_json, rd_kafka_t *signal_producer)
{
    if (!signal_producer || !alert_json)
    {
        json_decref(alert_json);
        return;
    }

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