#include <curl/curl.h>
#include <jansson.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <librdkafka/rdkafka.h>
#include "bulk.h"

#define OPENSEARCH_URL "http://OpenSearch:9200/traps/_bulk"
#define KAFKA_TOPIC "trap-signals"

int DATA_FLUSH_SIZE = 100;
int DATA_FLUSH_INTERVAL = 1;

json_t *opensearch_events_buffer[BULK_LIMIT];
int opensearch_events_count = 0;

json_t *kafka_signals_buffer[BULK_LIMIT];
int kafka_signals_count = 0;

rd_kafka_t *kafka_producer = NULL;

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

void send_bulk_to_kafka(void)
{
    if (!kafka_producer || kafka_signals_count == 0)
    {
        printf("[DEBUG] send_bulk_to_kafka called but kafka_alert_count = %d\n", kafka_signals_count);
        return;
    }

    printf("[INFO] Sending %d alerts to Kafka topic '%s'\n", kafka_signals_count, KAFKA_TOPIC);

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
            kafka_producer,
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
    while (rd_kafka_outq_len(kafka_producer) > 0 && remaining_timeout > 0)
    {
        int polled = rd_kafka_poll(kafka_producer, 100);
        remaining_timeout -= 100;
        if (polled == 0 && remaining_timeout > 0)
        {
        }
    }
    if (rd_kafka_outq_len(kafka_producer) > 0)
    {
        fprintf(stderr, "[WARN] %d messages still in Kafka producer queue after flush timeout.\n", rd_kafka_outq_len(kafka_producer));
    }

    kafka_signals_count = 0;
}

void send_bulk_to_opensearch(json_t **docs, int doc_count)
{
    CURL *curl;
    CURLcode res;
    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();

    if (!curl)
    {
        fprintf(stderr, "[ERROR] Failed to initialize CURL\n");
        return;
    }

    // Construct bulk body
    json_t *bulk_root = json_array();
    char *bulk_data = NULL;
    size_t total_len = 0;

    for (int i = 0; i < doc_count; i++)
    {
        json_t *eventId_json = json_object_get(docs[i], "eventId");
        const char *eventId = json_is_string(eventId_json) ? json_string_value(eventId_json) : NULL;

        if (!eventId)
        {
            fprintf(stderr, "[ERROR] Missing eventId in document %d\n", i);
            continue; // skip this doc
        }

        // Create metadata line with _id
        char meta_line[256];
        snprintf(meta_line, sizeof(meta_line), "{\"index\":{\"_id\":\"%s\"}}\n", eventId);

        char *json_str = json_dumps(docs[i], JSON_COMPACT);
        size_t meta_len = strlen(meta_line);
        size_t json_len = strlen(json_str);
        size_t line_len = meta_len + json_len + 2; // \n at the end

        bulk_data = realloc(bulk_data, total_len + line_len + 1);
        if (!bulk_data)
        {
            fprintf(stderr, "[ERROR] Memory allocation failed\n");
            free(json_str);
            return;
        }

        snprintf(bulk_data + total_len, line_len + 1, "%s%s\n", meta_line, json_str);
        total_len += line_len;

        free(json_str);
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/x-ndjson");

    curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_data);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    res = curl_easy_perform(curl);
    if (res != CURLE_OK)
    {
        fprintf(stderr, "[ERROR] OpenSearch request failed: %s\n", curl_easy_strerror(res));
    }

    curl_easy_cleanup(curl);
    curl_global_cleanup();
    free(bulk_data);
}

void add_to_kafka_bulk(json_t *alert_json, rd_kafka_t *producer, const char *topic)
{
    if (!producer || !alert_json)
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

    // This part requires a more robust solution for multiple topics/producers.
    // For simplicity, this example assumes we are using the `kafka_signals_buffer`
    // and `kafka_signals_count` as a shared resource and will flush it based on
    // the producer/topic passed. A better approach would be separate buffers
    // for each topic if high throughput is expected on both.
    kafka_signals_buffer[kafka_signals_count++] = copied_alert;
    printf("[INFO] Added alert to Kafka buffer for topic '%s'. Current count: %d\n", topic, kafka_signals_count);

    if (kafka_signals_count >= BULK_LIMIT)
    {
        printf("[INFO] Kafka bulk buffer full for topic '%s'. Sending bulk...\n", topic);
        send_bulk_to_kafka();
    }
}

void add_alert_to_kafka_bulk(json_t *alert_json)
{
    if (!kafka_producer || !alert_json)
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
            send_bulk_to_kafka();
        }
    }
    else
    {
        fprintf(stderr, "[WARN] Kafka buffer is unexpectedly full. Forcing flush and adding new alert.\n");
        send_bulk_to_kafka();
        kafka_signals_buffer[kafka_signals_count++] = copied_alert;
    }
}