#include <stdio.h>
#include <stdlib.h>
#include <signal.h>
#include <pthread.h>
#include <unistd.h>
#include <time.h>
#include <librdkafka/rdkafka.h>

#include "globals.h"

//rd_kafka_t *signal_producer = NULL;

volatile int run = 1;

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

rd_kafka_t *setup_kafka_consumer(const char *brokers, const char *group_id, const char *topic, rd_kafka_topic_partition_list_t **topics_out)
{
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "group.id", group_id, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "auto.offset.reset", "latest", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK ||
        rd_kafka_conf_set(conf, "enable.auto.commit", "false", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK )
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
    
    printf("🚀 Consumer listening for syslogs...\n");

    setbuf(stdout, NULL);

    load_env_config();

    create_syslogs_index();

    rd_kafka_t *signal_producer = init_signal_producer("kafka:9092");

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
    rd_kafka_t *rk = setup_kafka_consumer("kafka:9092", "syslog-events-group", "syslog-events", &topics);
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
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);
    rd_kafka_destroy(signal_producer);

    return 0;
}
