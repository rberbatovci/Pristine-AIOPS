#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <librdkafka/rdkafka.h>
#include "globals.h"
#include <hiredis/hiredis.h>

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

void print_banner() {
    printf("\n");
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                   v1.1 beta                  ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
}

int main() {
    setbuf(stdout, NULL);

    activeSignalMonitor();
    print_banner();
    printf("🚀 Consumer listening for signals ...\n");

    create_syslog_signals_index();

    redisContext *redis_ctx = NULL;
    if (on_startup_redis("redis", 6379) < 0) {
        fprintf(stderr, "[ERROR] Redis startup failed. Continuing without Redis...\n");
    }

    PGconn *conn = PQconnectdb("host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword");
    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to DB failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return EXIT_FAILURE;
    }

    load_signal_rules(conn);
    PQfinish(conn);

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

    flushOpensearchBulkData();

    rd_kafka_topic_partition_list_t *topics;
    rd_kafka_t *rk = setup_kafka_consumer("Kafka:9092", "syslog-signals-group", "syslog-signals", &topics);
    if (!rk) return EXIT_FAILURE;

    printf("[INFO] Subscribed to kafka topic\n");

    // 👇 Here’s where your signal memory is already ready
    process_message(rk);  // Uses active_signals[]

    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);
    if (redis_ctx) redisFree(redis_ctx);
    return EXIT_SUCCESS;
}
