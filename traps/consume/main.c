#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <librdkafka/rdkafka.h>

#include "process.h"
#include "bulk.h"
#include "config.h"

json_t *opensearch_buffer[BULK_LIMIT];
int opensearch_count = 0;

rd_kafka_t *kafka_alert_producer;

rd_kafka_t* setup_kafka_consumer(const char* brokers, const char* group_id, const char* topic, rd_kafka_topic_partition_list_t **topics_out) {
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "group.id", group_id, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "auto.offset.reset", "earliest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "[ERROR] Kafka conf failed: %s\n", errstr);
        return NULL;
    }

    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to create Kafka consumer: %s\n", errstr);
        return NULL;
    }

    rd_kafka_poll_set_consumer(rk);

    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, topic, -1);

    if (rd_kafka_subscribe(rk, topics)) {
        fprintf(stderr, "[ERROR] Failed to subscribe to topic: %s\n", topic);
        return NULL;
    }

    *topics_out = topics;
    return rk;
}


int main() {
    pthread_t reload_thread;
    
    ReloadArgs* args = malloc(sizeof(ReloadArgs));
    if (!args) {
        fprintf(stderr, "Failed to allocate memory for reload args\n");
        return 1;
    }

    args->interval_seconds = 60;

    if (pthread_create(&reload_thread, NULL, reload_data_thread, args) != 0) {
        fprintf(stderr, "Failed to create reload thread\n");
        free(args);
        return 1;
    }

    const char *brokers = "Kafka:9092";
    const char *topic = "trap-topic";

    kafka_alert_producer = init_kafka_alert_producer("Kafka:9092");
    if (!kafka_alert_producer) exit(1);

    rd_kafka_topic_partition_list_t *topics;
    rd_kafka_t *rk = setup_kafka_consumer(brokers, "trap-consumer-group", topic, &topics);
    if (!rk) return 1;

    printf("[INFO] Subscribed to topic: %s\n", topic);

    process_kafka_message_loop(rk);

    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);
    return 0;
}
