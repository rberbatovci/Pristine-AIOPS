#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <pthread.h>
#include <unistd.h>
#include <time.h>
#include <librdkafka/rdkafka.h>

#include "process.h"
#include "bulk.h"
#include "config.h"

// Global Kafka producer
rd_kafka_t *kafka_alert_producer;

// Running flag for flush thread
volatile int running = 1;

// Flush thread function
void *flush_loop(void *arg)
{
    while (running)
    {
        sleep(DATA_FLUSH_INTERVAL);

        if (opensearch_count > 0)
        {
            //printf("[INFO] Sending %d documents to OpenSearch.\n", opensearch_count);
            send_bulk_to_opensearch(opensearch_buffer, opensearch_count);

            for (int i = 0; i < opensearch_count; i++)
                json_decref(opensearch_buffer[i]);
            opensearch_count = 0;
        }

        send_bulk_to_kafka();
    }
    return NULL;
}

rd_kafka_t *setup_kafka_consumer(const char *brokers, const char *group_id, const char *topic, rd_kafka_topic_partition_list_t **topics_out)
{
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "group.id", group_id, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "auto.offset.reset", "latest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK)
    {
        fprintf(stderr, "[ERROR] Kafka conf failed: %s\n", errstr);
        return NULL;
    }

    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!rk)
    {
        fprintf(stderr, "[ERROR] Failed to create Kafka consumer: %s\n", errstr);
        return NULL;
    }

    rd_kafka_poll_set_consumer(rk);

    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, topic, -1);

    if (rd_kafka_subscribe(rk, topics))
    {
        fprintf(stderr, "[ERROR] Failed to subscribe to topic: %s\n", topic);
        return NULL;
    }

    *topics_out = topics;
    return rk;
}

void print_banner() {
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                   v1.1 beta                  ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
    printf("\n");
}

int main()
{
    print_banner();
    
    printf("Consumer listening for syslogs...\n");

    setbuf(stdout, NULL);

    load_env_config();

    pthread_t reload_thread;
    ReloadArgs reload_args = {.interval_seconds = 300};

    if (pthread_create(&reload_thread, NULL, reload_data_thread, &reload_args) != 0)
    {
        fprintf(stderr, "[ERROR] Failed to create reload_data_thread\n");
        return 1;
    }

    // Start the flush thread
    pthread_t flush_thread;
    if (pthread_create(&flush_thread, NULL, flush_loop, NULL) != 0)
    {
        fprintf(stderr, "[ERROR] Failed to create flush thread\n");
        return 1;
    }

    const char *brokers = "Kafka:9092";
    const char *topic = "syslog-events";

    kafka_alert_producer = init_kafka_alert_producer(brokers);
    if (!kafka_alert_producer)
    {
        fprintf(stderr, "[ERROR] Failed to initialize Kafka producer\n");
        running = 0;
        pthread_join(flush_thread, NULL);
        return 1;
    }

    rd_kafka_topic_partition_list_t *topics;
    rd_kafka_t *rk = setup_kafka_consumer(brokers, "syslog-events", topic, &topics);
    if (!rk)
    {
        running = 0;
        pthread_join(flush_thread, NULL);
        return 1;
    }

    process_message(rk);

    running = 0;
    pthread_join(flush_thread, NULL);

    if (opensearch_count > 0)
    {
        printf("[INFO] Flushing %d remaining documents to OpenSearch before exit.\n", opensearch_count);
        send_bulk_to_opensearch(opensearch_buffer, opensearch_count);
        for (int i = 0; i < opensearch_count; i++)
            json_decref(opensearch_buffer[i]);
        opensearch_count = 0;
    }

    if (kafka_alert_count > 0)
    {
        printf("[INFO] Flushing %d remaining alerts to Kafka before exit.\n", kafka_alert_count);
        send_bulk_to_kafka();
    }

    rd_kafka_flush(kafka_alert_producer, 3000);
    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);
    rd_kafka_destroy(kafka_alert_producer);

    return 0;
}
