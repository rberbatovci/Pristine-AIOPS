#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <librdkafka/rdkafka.h>
#include <pthread.h>
#include <unistd.h>
#include <jansson.h>
#include "globals.h"

static volatile sig_atomic_t run = 1;

static void stop_program(int sig) {
    run = 0;
    fprintf(stderr, "[INFO] Received signal %d, initiating graceful shutdown...\n", sig);
}

void *flush_loop(void *arg)
{
    rd_kafka_t *signal_producer = (rd_kafka_t *)arg;

    while (run)
    {
        sleep(DATA_FLUSH_INTERVAL);
        
        // Debug print
        printf("[DEBUG] Entering flush loop. Current OpenSearch buffer count: %d\n", opensearch_events_count);
        
        if (opensearch_events_count > 0)
        {
            send_bulk_to_opensearch(opensearch_events_buffer, opensearch_events_count);

            for (int i = 0; i < opensearch_events_count; i++)
                json_decref(opensearch_events_buffer[i]);
            opensearch_events_count = 0;
        }

        send_bulk_to_kafka(signal_producer);
    }
    return NULL;
}

rd_kafka_t* setup_kafka_consumer(const char* brokers, const char* group_id, const char* topic, rd_kafka_topic_partition_list_t **topics_out) {
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "group.id", group_id, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "auto.offset.reset", "latest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "enable.auto.commit", "false", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ) {
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

/* =========================================================
 * KAFKA TOPIC CREATION
 * ========================================================= */

void create_topic_if_needed(rd_kafka_t *rk)
{
    rd_kafka_NewTopic_t *new_topic;
    rd_kafka_AdminOptions_t *options;
    rd_kafka_queue_t *queue;

    /* Create topic definition */
    new_topic = rd_kafka_NewTopic_new(
        KAFKA_SIGNALS_TOPIC,
        3,      /* partitions */
        1,      /* replication factor */
        NULL,
        0
    );

    rd_kafka_NewTopic_t *topics[] = { new_topic };

    /* Admin options */
    options = rd_kafka_AdminOptions_new(
        rk,
        RD_KAFKA_ADMIN_OP_CREATETOPICS
    );

    /* Temporary queue for admin response */
    queue = rd_kafka_queue_new(rk);

    /* Send create topic request */
    rd_kafka_CreateTopics(
        rk,
        topics,
        1,
        options,
        queue
    );

    printf("⏳ Creating Kafka topic '%s'...\n",
           KAFKA_SIGNALS_TOPIC);

    /* Wait for result */
    rd_kafka_event_t *event =
        rd_kafka_queue_poll(queue, 10000);

    if (!event)
    {
        fprintf(stderr, "❌ No response from Kafka admin API\n");
    }
    else if (rd_kafka_event_error(event))
    {
        /*
         * IMPORTANT:
         * Topic already exists is NOT fatal
         */
        if (rd_kafka_event_error(event) ==
            RD_KAFKA_RESP_ERR_TOPIC_ALREADY_EXISTS)
        {
            printf("✅ Topic already exists\n");
        }
        else
        {
            fprintf(stderr,
                    "❌ Topic creation failed: %s\n",
                    rd_kafka_event_error_string(event));
        }
    }
    else
    {
        printf("✅ Topic '%s' created successfully\n",
               KAFKA_SIGNALS_TOPIC);
    }

    /* Cleanup */
    if (event)
        rd_kafka_event_destroy(event);

    rd_kafka_queue_destroy(queue);
    rd_kafka_AdminOptions_destroy(options);
    rd_kafka_NewTopic_destroy(new_topic);
}

void print_banner() {
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                   v1.1 beta                  ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
    printf("\n");
}

int main() {
    setbuf(stdout, NULL);

    print_banner();

    printf("🚀 Consumer listening for SNMPv3 traps...\n");

    create_traps_index();

    rd_kafka_t *signal_producer = init_signal_producer("kafka:9092");

    create_topic_if_needed(signal_producer);

    if (!signal_producer)
    {
        fprintf(stderr,
                "[ERROR] Failed to initialize Kafka alert producer.\n"); 
        return 1;
    }

    signal(SIGINT, stop_program);
    signal(SIGTERM, stop_program);

    pthread_t reload_thread;
    ReloadArgs reload_args = {.interval_seconds = 300};

    if (pthread_create(&reload_thread, NULL, reload_data_thread, &reload_args) != 0)
    {
        fprintf(stderr, "[ERROR] Failed to create reload_data_thread\n");
        return 1;
    }

    pthread_t flush_thread;
    if (pthread_create(&flush_thread, NULL, flush_loop, signal_producer) != 0)
    {
        fprintf(stderr, "[ERROR] Failed to create flush thread\n");
        return 1;
    }

    if (!signal_producer) {
        fprintf(stderr, "[ERROR] Failed to initialize Kafka alert producer. Exiting.\n");
        pthread_cancel(reload_thread);
        pthread_join(reload_thread, NULL);
        //free(args);
        return 1;
    }

    rd_kafka_topic_partition_list_t *topics;
    rd_kafka_t *rk = setup_kafka_consumer("kafka:9092", "trap-events-group", "trap-events", &topics);
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to set up Kafka consumer. Exiting.\n");
        if (signal_producer)
            rd_kafka_destroy(signal_producer);
        run = 0;
        pthread_join(reload_thread, NULL);
        //free(args);
        return 1;
    }

    printf("[DEBUG] Starting process_message()\n");
    process_message(rk, signal_producer);
    fprintf(stderr, "[INFO] process_message returned, exiting application.\n");
    
    rd_kafka_flush(signal_producer, 3000);
    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_destroy(signal_producer);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);
    return 0;
}