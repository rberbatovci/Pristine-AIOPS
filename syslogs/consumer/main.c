#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <pthread.h>
#include <unistd.h>
#include <time.h>

#include <librdkafka/rdkafka.h>

#include "globals.h"

volatile int run = 1;

/* =========================================================
 * SIGNAL HANDLER
 * ========================================================= */

static void stop_program(int sig)
{
    run = 0;

    fprintf(stderr,
            "[INFO] Received signal %d, initiating graceful shutdown...\n",
            sig);
}

/* =========================================================
 * FLUSH LOOP
 * ========================================================= */

void *flush_loop(void *arg)
{
    rd_kafka_t *signal_producer = (rd_kafka_t *)arg;

    while (run)
    {
        sleep(DATA_FLUSH_INTERVAL);

        printf("[DEBUG] Entering flush loop. "
               "Current OpenSearch buffer count: %d\n",
               opensearch_events_count);

        /* =========================================
         * OpenSearch flush
         * ========================================= */

        if (opensearch_events_count > 0)
        {
            printf("[DEBUG] Flushing %d events to OpenSearch...\n",
                   opensearch_events_count);

            send_bulk_to_opensearch(
                opensearch_events_buffer,
                opensearch_events_count);

            for (int i = 0; i < opensearch_events_count; i++)
            {
                json_decref(opensearch_events_buffer[i]);
            }

            opensearch_events_count = 0;
        }

        /* =========================================
         * Kafka flush
         * ========================================= */

        send_bulk_to_kafka(signal_producer);

        /*
         * IMPORTANT:
         * serve producer callbacks
         */
        rd_kafka_poll(signal_producer, 0);
    }

    return NULL;
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

/* =========================================================
 * BANNER
 * ========================================================= */

void print_banner()
{
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS         ║\n");
    printf("║                  v1.2 stable                ║\n");
    printf("║          Syslog Kafka Consumer              ║\n");
    printf("╚══════════════════════════════════════════════╝\n");

    printf("\n");
}

/* =========================================================
 * MAIN
 * ========================================================= */

int main()
{
    signal(SIGINT, stop_program);
    signal(SIGTERM, stop_program);

    setbuf(stdout, NULL);
    setbuf(stderr, NULL);

    print_banner();

    printf("🚀 Consumer listening for syslogs...\n");

    /* =========================================
     * OpenSearch index
     * ========================================= */

    create_syslogs_index();

    /* =========================================
     * Kafka signal producer
     * ========================================= */

    rd_kafka_t *signal_producer =
        init_signal_producer("kafka:9092");

    if (!signal_producer)
    {
        fprintf(stderr,
                "[ERROR] Failed to initialize Kafka alert producer.\n");

        return 1;
    }

    /* =========================================
     * Reload thread
     * ========================================= */

    pthread_t reload_thread;

    ReloadArgs reload_args = {
        .interval_seconds = 300};

    if (pthread_create(&reload_thread,
                       NULL,
                       reload_data_thread,
                       &reload_args) != 0)
    {
        fprintf(stderr,
                "[ERROR] Failed to create reload thread\n");

        rd_kafka_destroy(signal_producer);

        return 1;
    }

    /* =========================================
     * Flush thread
     * ========================================= */

    pthread_t flush_thread;

    if (pthread_create(&flush_thread,
                       NULL,
                       flush_loop,
                       signal_producer) != 0)
    {
        fprintf(stderr,
                "[ERROR] Failed to create flush thread\n");

        run = 0;

        pthread_join(reload_thread, NULL);

        rd_kafka_destroy(signal_producer);

        return 1;
    }

    /* =========================================
     * Kafka consumer
     * ========================================= */

    rd_kafka_topic_partition_list_t *topics;

    rd_kafka_t *rk =
        setup_kafka_consumer(
            "kafka:9092",
            "debug-syslog-group",
            "syslog-events",
            &topics);

    if (!rk)
    {
        fprintf(stderr,
                "[ERROR] Failed to set up Kafka consumer.\n");

        run = 0;

        pthread_join(reload_thread, NULL);
        pthread_join(flush_thread, NULL);

        rd_kafka_destroy(signal_producer);

        return 1;
    }

    printf("[DEBUG] Starting process_message()\n");

    /*
     * IMPORTANT:
     * Uses your existing process.c implementation
     */
    process_message(rk, signal_producer);

    fprintf(stderr,
            "[INFO] process_message returned, exiting application.\n");

    /* =========================================
     * Shutdown
     * ========================================= */

    run = 0;

    pthread_join(reload_thread, NULL);
    pthread_join(flush_thread, NULL);

    rd_kafka_flush(signal_producer, 3000);

    rd_kafka_topic_partition_list_destroy(topics);

    rd_kafka_consumer_close(rk);

    rd_kafka_destroy(rk);

    rd_kafka_destroy(signal_producer);

    printf("✅ Shutdown complete\n");

    return 0;
}