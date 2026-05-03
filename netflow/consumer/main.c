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
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    rd_kafka_conf_set(conf, "bootstrap.servers", "kafka:9092", errstr, sizeof(errstr));
    rd_kafka_conf_set(conf, "group.id", "netflow-consumer-group", errstr, sizeof(errstr));

    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    rd_kafka_poll_set_consumer(rk);

    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, TOPIC_NAME, -1);
    rd_kafka_subscribe(rk, topics);

    printf("📡 Listening...\n");

    while (keep_running) {
        rd_kafka_message_t *msg = rd_kafka_consumer_poll(rk, 1000);
        if (!msg) continue;

        if (!msg->err) {
            char *copy = malloc(msg->len + 1);
            memcpy(copy, msg->payload, msg->len);
            copy[msg->len] = '\0';

            queue_push(&raw_queue, copy);
        }

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