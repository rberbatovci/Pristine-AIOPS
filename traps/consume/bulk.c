#include <curl/curl.h>
#include <jansson.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <librdkafka/rdkafka.h>

#define OPENSEARCH_URL "http://OpenSearch:9200/traps/_bulk"

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

void send_alert_to_kafka(rd_kafka_t *producer, const char *topic, const char *json_alert) {
    rd_kafka_resp_err_t err = rd_kafka_producev(
        producer,
        RD_KAFKA_V_TOPIC(topic),
        RD_KAFKA_V_VALUE(json_alert, strlen(json_alert)),
        RD_KAFKA_V_END
    );

    if (err) {
        fprintf(stderr, "[ERROR] Failed to send alert to Kafka: %s\n", rd_kafka_err2str(err));
    }

    rd_kafka_poll(producer, 0);  // Serve delivery report callbacks
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
