#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <curl/curl.h>

#define KAFKA_TOPIC "netflow-topic"
#define OPENSEARCH_URL "http://localhost:9200/netflow/_doc/"
#define BROKER "localhost:9092"

rd_kafka_t *rk;  // Kafka consumer instance
rd_kafka_conf_t *conf;  // Kafka configuration
char errstr[512];  // Error string for Kafka

// Initialize Kafka consumer
void init_kafka_consumer(const char *brokers) {
    conf = rd_kafka_conf_new();

    // Set Kafka broker address
    if (rd_kafka_conf_set(conf, "metadata.broker.list", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "%% Error setting Kafka broker: %s\n", errstr);
        exit(1);
    }

    rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "%% Failed to create Kafka consumer: %s\n", errstr);
        exit(1);
    }

    // Create a list of topics to subscribe to
    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, KAFKA_TOPIC, RD_KAFKA_PARTITION_UA);

    // Subscribe to topics
    if (rd_kafka_subscribe(rk, topics) != RD_KAFKA_RESP_ERR_NO_ERROR) {
        fprintf(stderr, "%% Failed to subscribe to topic: %s\n", rd_kafka_err2str(rd_kafka_last_error()));
        exit(1);
    }

    rd_kafka_topic_partition_list_destroy(topics);
}

// Function to send data to OpenSearch
void send_to_opensearch(const char *json_data) {
    CURL *curl;
    CURLcode res;

    // Initialize curl
    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();
    
    if(curl) {
        // Set OpenSearch URL
        curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);

        // Set HTTP method to POST
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "POST");

        // Set the JSON payload
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data);

        // Set the Content-Type header to application/json
        struct curl_slist *headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        // Perform the request
        res = curl_easy_perform(curl);

        // Check if the request was successful
        if(res != CURLE_OK) {
            fprintf(stderr, "libcurl failed: %s\n", curl_easy_strerror(res));
        } else {
            printf("Data sent to OpenSearch successfully.\n");
        }

        // Cleanup
        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
}

// Kafka consumer callback to process received messages
void consume_messages() {
    while (1) {
        rd_kafka_message_t *msg;
        
        // Poll for new messages
        msg = rd_kafka_consumer_poll(rk, 1000); // 1 second timeout

        if (!msg) {
            continue;
        }

        if (msg->err) {
            fprintf(stderr, "Error receiving message: %s\n", rd_kafka_message_errstr(msg));
            continue;
        }

        // Print message value (NetFlow JSON data)
        printf("Received message: %s\n", (char *)msg->payload);

        // Send the message to OpenSearch
        send_to_opensearch((char *)msg->payload);

        rd_kafka_message_destroy(msg);
    }
}

int main() {
    // Initialize Kafka consumer
    init_kafka_consumer(BROKER);

    // Start consuming messages from Kafka and send to OpenSearch
    consume_messages();

    // Cleanup Kafka consumer
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);

    return 0;
}
