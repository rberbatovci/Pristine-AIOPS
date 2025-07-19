#include <curl/curl.h>
#include <jansson.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <librdkafka/rdkafka.h>

#define OPENSEARCH_URL "http://OpenSearch:9200/traps/_bulk"
#define KAFKA_TOPIC "trap-signals"

json_t *opensearch_buffer[BULK_LIMIT];
int opensearch_count = 0;

json_t *kafka_alert_buffer[BULK_LIMIT];
int kafka_alert_count = 0;

rd_kafka_t *kafka_producer = NULL;

void send_bulk_to_kafka(void);

rd_kafka_t *init_kafka_alert_producer(const char *brokers) {
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "[ERROR] Kafka conf set failed: %s\n", errstr);
        return NULL;
    }

    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to create Kafka producer: %s\n", errstr);
        return NULL;
    }

    return rk;
}

void send_bulk_to_kafka(void) {
    if (!kafka_producer || kafka_alert_count == 0) return;

    printf("[INFO] Sending %d alerts to Kafka topic '%s'\n", kafka_alert_count, KAFKA_TOPIC);

    for (int i = 0; i < kafka_alert_count; i++) {
        char *json_str = json_dumps(kafka_alert_buffer[i], JSON_COMPACT);
        if (!json_str) {
            fprintf(stderr, "[ERROR] Failed to serialize JSON for bulk send (index %d)\n", i);
            json_decref(kafka_alert_buffer[i]);
            continue;
        }

        rd_kafka_resp_err_t err = rd_kafka_producev(
            kafka_producer,
            RD_KAFKA_V_TOPIC(KAFKA_TOPIC),
            RD_KAFKA_V_VALUE(json_str, strlen(json_str)),
            RD_KAFKA_V_MSGFLAGS(RD_KAFKA_MSG_F_COPY),
            RD_KAFKA_V_END
        );

        if (err) {
            fprintf(stderr, "[ERROR] Kafka alert send failed (index %d): %s\n", i, rd_kafka_err2str(err));
        } else {
        }

        free(json_str);
        json_decref(kafka_alert_buffer[i]);
    }

    int remaining_timeout = 1000; 
    while (rd_kafka_outq_len(kafka_producer) > 0 && remaining_timeout > 0) {
        int polled = rd_kafka_poll(kafka_producer, 100); 
        remaining_timeout -= 100;
        if (polled == 0 && remaining_timeout > 0) { 
        }
    }
    if (rd_kafka_outq_len(kafka_producer) > 0) {
        fprintf(stderr, "[WARN] %d messages still in Kafka producer queue after flush timeout.\n", rd_kafka_outq_len(kafka_producer));
    }


    kafka_alert_count = 0;
}

void send_bulk_to_opensearch(json_t **docs, int doc_count) {
    CURL *curl;
    CURLcode res;
    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();

    if (!curl) {
        fprintf(stderr, "[ERROR] Failed to initialize CURL\n");
        return;
    }

    // Construct bulk body
    json_t *bulk_root = json_array();
    char *bulk_data = NULL;
    size_t total_len = 0;

    for (int i = 0; i < doc_count; i++) {
        const char *meta = "{\"index\":{}}\n";
        char *json_str = json_dumps(docs[i], JSON_COMPACT);

        size_t meta_len = strlen(meta);
        size_t json_len = strlen(json_str);
        size_t line_len = meta_len + json_len + 2;  // \n after each

        bulk_data = realloc(bulk_data, total_len + line_len + 1);
        if (!bulk_data) {
            fprintf(stderr, "[ERROR] Failed to allocate memory for bulk data\n");
            return;
        }

        snprintf(bulk_data + total_len, line_len + 1, "%s%s\n", meta, json_str);
        total_len += line_len;

        free(json_str);
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/x-ndjson");

    curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_data);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    res = curl_easy_perform(curl);
    if (res != CURLE_OK) {
        fprintf(stderr, "[ERROR] OpenSearch request failed: %s\n", curl_easy_strerror(res));
    }

    curl_easy_cleanup(curl);
    curl_global_cleanup();
    free(bulk_data);
}

void add_alert_to_kafka_bulk(json_t *alert_json) {
    if (!kafka_producer || !alert_json) {
        json_decref(alert_json); 
        return;
    }

    json_t *copied_alert = json_deep_copy(alert_json);
    if (!copied_alert) {
        fprintf(stderr, "[ERROR] Failed to deep copy JSON for Kafka bulk buffer.\n");
        json_decref(alert_json);
        return;
    }

    kafka_alert_buffer[kafka_alert_count++] = copied_alert;
    printf("[INFO] Added alert to Kafka buffer. Current count: %d\n", kafka_alert_count);

    if (kafka_alert_count >= BULK_LIMIT) {
        printf("[INFO] Kafka alert buffer full. Sending bulk...\n");
        send_bulk_to_kafka();
    }
}