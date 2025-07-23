#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <librdkafka/rdkafka.h>
#include <pthread.h>

#include "process.h"
#include "bulk.h"
#include "config.h"

#define KAFKA_BROKER "Kafka:9092"
#define KAFKA_EVENTS_TOPIC "trap-events"
#define KAFKA_SIGNALS_TOPIC "trap-signals"

rd_kafka_t *signal_producer;

static volatile sig_atomic_t run = 1;

static void stop_program(int sig) {
    run = 0;
    fprintf(stderr, "[INFO] Received signal %d, initiating graceful shutdown...\n", sig);
}

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

// Function to initialize a generic Kafka producer
rd_kafka_t* init_kafka_producer(const char* brokers) {
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

int main() {
    setbuf(stdout, NULL);

    load_env_config();

    printf("[CONFIG] DATA_FLUSH_SIZE = %d\n", DATA_FLUSH_SIZE);
    printf("[CONFIG] DATA_FLUSH_INTERVAL = %d seconds\n", DATA_FLUSH_INTERVAL);

    signal(SIGINT, stop_program);
    signal(SIGTERM, stop_program);

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

    // Initialize Kafka alert producer
    signal_producer = init_kafka_producer(KAFKA_BROKER);
    if (!signal_producer) {
        fprintf(stderr, "[ERROR] Failed to initialize Kafka alert producer. Exiting.\n");
        // Attempt to clean up reload thread before exiting
        pthread_cancel(reload_thread);
        pthread_join(reload_thread, NULL);
        free(args);
        return 1;
    }

    rd_kafka_topic_partition_list_t *consumer_topics_list;
    rd_kafka_t *rk = setup_kafka_consumer(KAFKA_BROKER, "trap-events-group", KAFKA_EVENTS_TOPIC, &consumer_topics_list);
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to set up Kafka consumer. Exiting.\n");
        // Clean up producer and reload thread before exiting
        rd_kafka_destroy(signal_producer);
        pthread_cancel(reload_thread);
        pthread_join(reload_thread, NULL);
        free(args);
        return 1;
    }

    process_message(rk, signal_producer);

    rd_kafka_destroy(signal_producer);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);
    return 0;
}