#include <curl/curl.h>
#include <jansson.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <librdkafka/rdkafka.h>
#include "bulk.h"

#define OPENSEARCH_URL "http://OpenSearch:9200/syslogs/_bulk"
#define KAFKA_TOPIC "syslog-signals"

int DATA_FLUSH_SIZE = 100;
int DATA_FLUSH_INTERVAL = 1;

// Declare buffers and counters
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

void send_bulk_to_kafka()
{
    if (kafka_signals_count == 0)
        return;

    // rd_kafka_t *rk = init_kafka_alert_producer();  // WRONG: missing argument, recreate producer every time!
    // Use the global producer:
    if (!kafka_producer)
    {
        fprintf(stderr, "[ERROR] Kafka producer not initialized\n");
        return;
    }

    rd_kafka_topic_t *rkt = rd_kafka_topic_new(kafka_producer, KAFKA_TOPIC, NULL);

    if (!rkt)
    {
        fprintf(stderr, "[ERROR] Failed to create Kafka topic handle\n");
        return;
    }

    for (int i = 0; i < kafka_signals_count; i++)
    {
        if (!json_is_object(kafka_signals_buffer[i]))
        {
            continue;
        }

        char *json_str = json_dumps(kafka_signals_buffer[i], JSON_COMPACT);
        if (!json_str)
        {
            fprintf(stderr, "[WARN] Failed to convert JSON to string\n");
            continue;
        }

        if (rd_kafka_produce(
                rkt,
                RD_KAFKA_PARTITION_UA,
                RD_KAFKA_MSG_F_COPY,
                json_str, strlen(json_str),
                NULL, 0,
                NULL) == -1)
        {
            fprintf(stderr, "[ERROR] Kafka produce failed: %s\n", rd_kafka_err2str(rd_kafka_last_error()));
        }

        free(json_str);
        json_decref(kafka_signals_buffer[i]); // ✅ Important
    }

    kafka_signals_count = 0;

    rd_kafka_flush(kafka_producer, 1000);
    rd_kafka_topic_destroy(rkt);
}

void add_alert_to_kafka_bulk(json_t *alert_json)
{
    if (!kafka_producer)
    {
        fprintf(stderr, "[ERROR] Invalid Kafka producer\n");
        return;
    }

    if (!json_is_object(alert_json))
    {
        fprintf(stderr, "[ERROR] Attempted to buffer a non-object JSON alert\n");
        return;
    }

    if (kafka_signals_count < DATA_FLUSH_SIZE)
    {
        kafka_signals_buffer[kafka_signals_count++] = json_incref(alert_json);
    }
    else
    {
        printf("[INFO] Kafka buffer full. Sending bulk...\n");
        send_bulk_to_kafka();
        kafka_signals_buffer[kafka_signals_count++] = json_incref(alert_json);
    }
}

void send_bulk_to_opensearch(json_t **buffer, int count)
{
    CURL *curl = curl_easy_init();
    if (!curl)
    {
        fprintf(stderr, "[ERROR] Failed to init CURL\n");
        return;
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/x-ndjson");

    // Build bulk payload
    size_t bulk_size = 1;                      // For null terminator
    char *bulk_payload = calloc(1, bulk_size); // Start with empty string

    for (int i = 0; i < count; i++)
    {
        const char *event_id = json_string_value(json_object_get(buffer[i], "eventId"));
        if (!event_id)
        {
            fprintf(stderr, "[WARN] Missing eventId in buffer[%d]\n", i);
            continue;
        }

        char *json_str = json_dumps(buffer[i], JSON_COMPACT);
        if (!json_str)
            continue;

        char action_line[512];
        snprintf(action_line, sizeof(action_line),
                 "{ \"index\": { \"_index\": \"syslogs\", \"_id\": \"%s\" } }\n", event_id);

        size_t additional_size = strlen(action_line) + strlen(json_str) + 2;
        bulk_payload = realloc(bulk_payload, bulk_size + additional_size);
        if (!bulk_payload)
        {
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

    curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_payload);

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK)
    {
        fprintf(stderr, "[ERROR] Failed to send to OpenSearch: %s\n", curl_easy_strerror(res));
    }

    free(bulk_payload);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
}
