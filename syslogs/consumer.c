#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <librdkafka/rdkafka.h>
#include <curl/curl.h>
#include <cjson/cJSON.h>

#define KAFKA_BROKER "localhost:9092"
#define KAFKA_TOPIC "syslog-topic"
#define OPENSEARCH_URL "http://localhost:9200/syslogs/_doc/"
#define CONSUMER_GROUP "syslog-consumer-group"

static volatile sig_atomic_t run = 1;

// Signal handler for graceful shutdown
void stop(int sig) {
    run = 0;
}

// OpenSearch HTTP POST function
void send_to_opensearch(const char *json_doc) {
    CURL *curl;
    CURLcode res;
    struct curl_slist *headers = NULL;

    curl = curl_easy_init();
    if (curl) {
        headers = curl_slist_append(headers, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_doc);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            fprintf(stderr, "curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
        }

        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
}

// Process Kafka message
void handle_message(rd_kafka_message_t *msg) {
    if (msg->err) {
        fprintf(stderr, "Consumer error: %s\n", rd_kafka_message_errstr(msg));
        return;
    }

    cJSON *root = cJSON_Parse((const char *)msg->payload);
    if (!root) {
        fprintf(stderr, "JSON parse error: %s\n", (char *)msg->payload);
        return;
    }

    cJSON *device = cJSON_GetObjectItem(root, "device");
    cJSON *message = cJSON_GetObjectItem(root, "message");

    if (cJSON_IsString(device) && cJSON_IsString(message)) {
        char json_doc[2048];
        snprintf(json_doc, sizeof(json_doc), 
                "{\"device\":\"%s\",\"message\":\"%s\"}",
                device->valuestring, message->valuestring);
        
        send_to_opensearch(json_doc);
        printf("Indexed: %s => %.*s...\n", 
              device->valuestring, 50, message->valuestring);
    }

    cJSON_Delete(root);
}

int main() {
    rd_kafka_t *consumer;
    rd_kafka_conf_t *conf;
    char errstr[512];

    // Set up signal handlers
    signal(SIGINT, stop);
    signal(SIGTERM, stop);

    // Create Kafka configuration
    conf = rd_kafka_conf_new();

    // Configure Kafka
    if (rd_kafka_conf_set(conf, "bootstrap.servers", KAFKA_BROKER, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "Kafka config error: %s\n", errstr);
        exit(1);
    }

    // Set consumer group
    if (rd_kafka_conf_set(conf, "group.id", CONSUMER_GROUP, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "Failed to set group.id: %s\n", errstr);
        exit(1);
    }

    // Start from earliest if no offset exists
    if (rd_kafka_conf_set(conf, "auto.offset.reset", "earliest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "Failed to set offset reset: %s\n", errstr);
    }

    // Create consumer instance
    consumer = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!consumer) {
        fprintf(stderr, "Failed to create consumer: %s\n", errstr);
        exit(1);
    }

    // Subscribe to topic
    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, KAFKA_TOPIC, RD_KAFKA_PARTITION_UA);
    if (rd_kafka_subscribe(consumer, topics) != RD_KAFKA_RESP_ERR_NO_ERROR) {
        fprintf(stderr, "Failed to subscribe to topic\n");
        exit(1);
    }
    rd_kafka_topic_partition_list_destroy(topics);

    printf("Consumer (%s) started. Waiting for messages...\n", CONSUMER_GROUP);

    // Main consumption loop
    while (run) {
        rd_kafka_message_t *msg = rd_kafka_consumer_poll(consumer, 1000);
        if (msg) {
            handle_message(msg);
            rd_kafka_message_destroy(msg);
        }
    }

    // Cleanup
    rd_kafka_consumer_close(consumer);
    rd_kafka_destroy(consumer);

    printf("Consumer stopped gracefully\n");
    return 0;
}