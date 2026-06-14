#include <pthread.h>
#include "globals.h" 
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <librdkafka/rdkafka.h>
#include <curl/curl.h>
#include <jansson.h>
#include <signal.h>
#include <unistd.h>
#include <stdbool.h>  // for bool, true, false
#include <ctype.h>    // for isdigit()

#define TOPIC_NAME "netflow-events"
 
queue_t raw_queue;
queue_t bulk_queue;

volatile sig_atomic_t keep_running = 1;

void handle_sigterm(int sig) {
    keep_running = 0;
} 

void print_banner() {
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                     v1.2                     ║\n");
    printf("║                Netflow Consumer              ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
    printf("\n");
}


/* =========================================================
 * KAFKA CONSUMER SETUP
 * ========================================================= */

rd_kafka_t *setup_kafka_consumer(
    const char *brokers,
    const char *group_id,
    const char *topic,
    rd_kafka_topic_partition_list_t **topics_out)
{
    char errstr[512];

    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    /* =========================================
     * Bootstrap servers
     * ========================================= */

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK)
    {
        fprintf(stderr,
                "[ERROR] bootstrap.servers: %s\n",
                errstr);

        return NULL;
    }

    /* =========================================
     * Consumer group
     * ========================================= */

    if (rd_kafka_conf_set(conf, "group.id", group_id, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK)
    {
        fprintf(stderr,
                "[ERROR] group.id: %s\n",
                errstr);

        return NULL;
    }

    /* =========================================
     * Read old messages
     * ========================================= */

    if (rd_kafka_conf_set(conf, "auto.offset.reset", "earliest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK)
    {
        fprintf(stderr,
                "[ERROR] auto.offset.reset: %s\n",
                errstr);

        return NULL;
    }

    /* =========================================
     * Manual commits
     * ========================================= */

    if (rd_kafka_conf_set(conf, "enable.auto.commit", "false", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK)
    {
        fprintf(stderr,
                "[ERROR] enable.auto.commit: %s\n",
                errstr);

        return NULL;
    }

    rd_kafka_conf_set(conf, "enable.partition.eof", "false", errstr, sizeof(errstr));

    rd_kafka_conf_set(conf, "fetch.wait.max.ms", "100", errstr, sizeof(errstr));

    rd_kafka_conf_set(conf, "session.timeout.ms", "45000", errstr, sizeof(errstr));

    rd_kafka_conf_set(conf, "max.poll.interval.ms", "300000", errstr, sizeof(errstr));
  
    rd_kafka_conf_set(conf, "log_level", "4", errstr, sizeof(errstr));

    /* =========================================
     * Create consumer
     * ========================================= */

    rd_kafka_t *rk =
        rd_kafka_new(RD_KAFKA_CONSUMER,
                     conf,
                     errstr,
                     sizeof(errstr));

    if (!rk)
    {
        fprintf(stderr,
                "[ERROR] Failed to create Kafka consumer: %s\n",
                errstr);

        return NULL;
    }

    rd_kafka_poll_set_consumer(rk);

    /* =========================================
     * Topic subscription
     * ========================================= */

    rd_kafka_topic_partition_list_t *topics =
        rd_kafka_topic_partition_list_new(1);

    rd_kafka_topic_partition_list_add(
        topics,
        topic,
        RD_KAFKA_PARTITION_UA);

    if (rd_kafka_subscribe(rk, topics))
    {
        fprintf(stderr,
                "[ERROR] Failed to subscribe to topic: %s\n",
                topic);

        rd_kafka_destroy(rk);

        return NULL;
    }

    printf("[DEBUG] Successfully subscribed to topic: %s\n",
           topic);

    *topics_out = topics;

    return rk;
}


int main() {
    signal(SIGINT, handle_sigterm);
    signal(SIGTERM, handle_sigterm);

    print_banner();

    queue_init(&raw_queue);
    queue_init(&bulk_queue);

    pthread_t workers[WORKER_COUNT];
    pthread_t sender;

    for (int i = 0; i < WORKER_COUNT; i++) {
        pthread_create(&workers[i], NULL, worker_thread, NULL);
    }

    pthread_create(&sender, NULL, bulk_sender_thread, NULL);

    // --- Kafka setup (same as yours) ---
    rd_kafka_topic_partition_list_t *topics = NULL;

    rd_kafka_t *rk = setup_kafka_consumer(
        "kafka:9092",
        "netflow-consumer-group",
        TOPIC_NAME,
        &topics
    );

    if (!rk)
    {
        fprintf(stderr, "❌ Failed to initialize Kafka consumer\n");
        return 1;
    }

    while (keep_running)
    {
        rd_kafka_message_t *msg =
            rd_kafka_consumer_poll(rk, 1000);

        if (!msg)
            continue;

        if (msg->err)
        {
            fprintf(stderr,
                    "⚠️ Kafka error: %s\n",
                    rd_kafka_message_errstr(msg));

            rd_kafka_message_destroy(msg);
            continue;
        }

        char *copy = malloc(msg->len + 1);

        if (!copy)
        {
            fprintf(stderr, "❌ malloc failed\n");

            rd_kafka_message_destroy(msg);
            continue;
        }

        memcpy(copy, msg->payload, msg->len);

        copy[msg->len] = '\0';

        queue_push(&raw_queue, copy);

        // ✅ Manual offset commit
        rd_kafka_commit_message(rk, msg, 0);

        rd_kafka_message_destroy(msg);
    }

    // 🔥 Shutdown sequence
    printf("🔻 Draining queues...\n");

    queue_close(&raw_queue);

    for (int i = 0; i < WORKER_COUNT; i++) {
        pthread_join(workers[i], NULL);
    }

    queue_close(&bulk_queue);
    pthread_join(sender, NULL);

    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);

    printf("✅ Shutdown complete\n");
    return 0;
}