#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <librdkafka/rdkafka.h>

#include "rules.h"
#include "process.h"
#include "activeSignals.h"

rd_kafka_t* setup_kafka_consumer(const char* brokers, const char* group_id, const char* topic, rd_kafka_topic_partition_list_t **topics_out) {
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    // Set required Kafka configuration
    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "group.id", group_id, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "auto.offset.reset", "earliest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "[ERROR] Kafka config failed: %s\n", errstr);
        return NULL;
    }

    // Create Kafka consumer
    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to create Kafka consumer: %s\n", errstr);
        return NULL;
    }

    rd_kafka_poll_set_consumer(rk);

    // Subscribe to the topic
    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, topic, -1);

    if (rd_kafka_subscribe(rk, topics) != 0) {
        fprintf(stderr, "[ERROR] Failed to subscribe to topic: %s\n", topic);
        rd_kafka_topic_partition_list_destroy(topics);
        rd_kafka_destroy(rk);
        return NULL;
    }

    *topics_out = topics;
    return rk;
}

int main() {
    setbuf(stdout, NULL);

    // Start thread to reload rules and states periodically
    ReloadArgs* args = malloc(sizeof(ReloadArgs));
    if (!args) {
        fprintf(stderr, "[ERROR] Failed to allocate memory for reload args\n");
        return EXIT_FAILURE;
    }

    args->interval_seconds = 60;

    pthread_t reload_thread;
    if (pthread_create(&reload_thread, NULL, reload_data_thread, args) != 0) {
        fprintf(stderr, "[ERROR] Failed to create reload thread\n");
        free(args);
        return EXIT_FAILURE;
    }

    // Setup Kafka consumer
    const char *brokers = "Kafka:9092";
    const char *topic = "syslog-signals";
    rd_kafka_topic_partition_list_t *topics;

    flushOpensearchBulkData();

    rd_kafka_t *rk = setup_kafka_consumer(brokers, "syslog-consumer-group", topic, &topics);
    if (!rk) return EXIT_FAILURE;

    printf("[INFO] Subscribed to topic: %s\n", topic);

    // Main loop to consume and process messages
    process_message(rk);

    // Cleanup
    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);

    return EXIT_SUCCESS;
}
