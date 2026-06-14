#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <time.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h> 
#include <librdkafka/rdkafka.h>

#define MAX_BUFFER 2048
#define MAX_MESSAGE_SIZE 4096

#define KAFKA_BROKER "kafka:9092"
#define KAFKA_EVENTS_TOPIC "syslog-events"

rd_kafka_t *kafka_producer = NULL;

volatile sig_atomic_t running = 1;

/* =========================================================
 * STRUCTS
 * ========================================================= */

typedef struct
{
    char device[64];
    char payload[MAX_MESSAGE_SIZE];
} KafkaMessage;

/* =========================================================
 * SIGNAL HANDLER
 * ========================================================= */

void stop(int sig)
{
    running = 0;
}

/* =========================================================
 * ENV HELPERS
 * ========================================================= */

int get_udp_port()
{
    const char *env_port = getenv("SYSLOG_PORT");
    return env_port ? atoi(env_port) : 1160;
}

int get_max_batch_size()
{
    const char *env_val = getenv("DATA_FLUSH_SIZE");
    return env_val ? atoi(env_val) : 100;
}

int get_flush_interval()
{
    const char *env_val = getenv("DATA_FLUSH_INTERVAL");
    return env_val ? atoi(env_val) : 5;
}
 
void delivery_report(rd_kafka_t *rk,
                     const rd_kafka_message_t *rkmessage,
                     void *opaque)
{
    if (rkmessage->err)
    {
        fprintf(stderr, "❌ Delivery failed: %s\n", rd_kafka_err2str(rkmessage->err));
    }
    else
    {
        printf("✅ Delivered to %s [%d] offset %lld\n", rd_kafka_topic_name(rkmessage->rkt), rkmessage->partition, (long long)rkmessage->offset);
    }
}

/* =========================================================
 * CLEANUP
 * ========================================================= */

void cleanup()
{
    if (kafka_producer)
    {
        printf("🧹 Flushing Kafka producer...\n"); 
        rd_kafka_flush(kafka_producer, 10000); 
        rd_kafka_destroy(kafka_producer); 
        kafka_producer = NULL;
    }
}

/* =========================================================
 * ESCAPE JSON
 * ========================================================= */

void escape_json_string(const char *input,
                        char *output,
                        size_t out_size)
{
    size_t j = 0;

    for (size_t i = 0; input[i] != '\0' && j + 2 < out_size; i++)
    {
        switch (input[i])
        {
        case '"':
        case '\\':
            output[j++] = '\\';
            output[j++] = input[i];
            break;

        case '\n':
            output[j++] = '\\';
            output[j++] = 'n';
            break;

        case '\r':
            output[j++] = '\\';
            output[j++] = 'r';
            break;

        case '\t':
            output[j++] = '\\';
            output[j++] = 't';
            break;

        default:
            output[j++] = input[i];
        }
    }

    output[j] = '\0';
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
        KAFKA_EVENTS_TOPIC,
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
           KAFKA_EVENTS_TOPIC);

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
               KAFKA_EVENTS_TOPIC);
    }

    /* Cleanup */
    if (event)
        rd_kafka_event_destroy(event);

    rd_kafka_queue_destroy(queue);
    rd_kafka_AdminOptions_destroy(options);
    rd_kafka_NewTopic_destroy(new_topic);
}

/* =========================================================
 * KAFKA INIT
 * ========================================================= */

void init_kafka_producer()
{
    char errstr[512]; 
    rd_kafka_conf_t *conf = rd_kafka_conf_new();
 
    if (rd_kafka_conf_set(conf, "bootstrap.servers", KAFKA_BROKER, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK)
    {
        fprintf(stderr, "❌ %s\n", errstr);
        exit(1);
    }
 
    rd_kafka_conf_set(conf, "enable.idempotence", "true", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "acks", "all", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "retries", "10", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "max.in.flight.requests.per.connection", "5", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "compression.codec", "zstd", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "linger.ms", "5", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "batch.num.messages", "1000", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "queue.buffering.max.messages", "100000", errstr, sizeof(errstr)); 
    rd_kafka_conf_set(conf, "socket.keepalive.enable", "true", errstr, sizeof(errstr)); 
    rd_kafka_conf_set_dr_msg_cb(conf, delivery_report); 

    kafka_producer = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));

    if (!kafka_producer)
    {
        fprintf(stderr, "❌ Failed to create Kafka producer: %s\n", errstr); 
        exit(1);
    }

    printf("✅ Kafka producer initialized\n");
}

/* =========================================================
 * MAIN
 * ========================================================= */

int main()
{
    signal(SIGINT, stop);
    signal(SIGTERM, stop);

    setbuf(stdout, NULL);
    setbuf(stderr, NULL);

    printf("\n");
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║        Welcome to Pristine-AIOPS v1.2       ║\n");
    printf("║           Syslog Kafka Producer             ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
    printf("\n");
 
    printf("⏳ Waiting for Kafka startup...\n");
    sleep(10);

    init_kafka_producer();

    create_topic_if_needed(kafka_producer);

    int udp_port = get_udp_port();

    int MAX_BATCH_SIZE = get_max_batch_size();
    int FLUSH_INTERVAL_SEC = get_flush_interval();

    printf("🚀 Listening for syslog on UDP %d\n", udp_port);
    printf("📦 Batch size: %d\n", MAX_BATCH_SIZE);
    printf("⏱ Flush interval: %d sec\n", FLUSH_INTERVAL_SEC);

    /* =====================================================
     * UDP SOCKET
     * ===================================================== */

    int sockfd;

    struct sockaddr_in server_addr;
    struct sockaddr_in client_addr;

    socklen_t addr_len = sizeof(client_addr);

    char buffer[MAX_BUFFER];

    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0)
    {
        perror("socket"); 
        cleanup(); 
        exit(1);
    }

    memset(&server_addr, 0, sizeof(server_addr));

    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(udp_port);

    if (bind(sockfd,
             (struct sockaddr *)&server_addr,
             sizeof(server_addr)) < 0)
    {
        perror("bind"); 
        close(sockfd); 
        cleanup(); 
        exit(1);
    }

    /* =====================================================
     * MESSAGE BATCH
     * ===================================================== */

    KafkaMessage *batch =
        calloc(MAX_BATCH_SIZE, sizeof(KafkaMessage));

    if (!batch)
    {
        perror("calloc"); 
        close(sockfd); 
        cleanup(); 
        exit(1);
    }

    int batch_count = 0;

    time_t last_flush_time = time(NULL);

    /* =====================================================
     * MAIN LOOP
     * ===================================================== */

    while (running)
    {
        /*
         * Important:
         * continuously serve kafka callbacks
         */
        rd_kafka_poll(kafka_producer, 0);

        ssize_t recv_len =
            recvfrom(sockfd, buffer, MAX_BUFFER - 1, MSG_DONTWAIT, (struct sockaddr *)&client_addr, &addr_len);

        if (recv_len < 0)
        {
            usleep(10000);
            continue;
        }

        buffer[recv_len] = '\0';

        char device[64]; 
        strncpy(device, inet_ntoa(client_addr.sin_addr), sizeof(device) - 1); 
        device[sizeof(device) - 1] = '\0'; 
        printf("📥 Syslog from %s\n", device);

        /* Escape JSON */
        char escaped[MAX_BUFFER * 2]; 
        escape_json_string(buffer, escaped, sizeof(escaped));

        /* Store device */
        strncpy(batch[batch_count].device, device, sizeof(batch[batch_count].device) - 1);

        /* Build JSON payload */
        snprintf(batch[batch_count].payload, sizeof(batch[batch_count].payload), "{\"device\":\"%s\",\"message\":\"%s\"}", device, escaped);

        batch_count++;

        time_t now = time(NULL);

        /* =================================================
         * FLUSH CONDITIONS
         * ================================================= */

        if (batch_count >= MAX_BATCH_SIZE ||
            difftime(now, last_flush_time) >= FLUSH_INTERVAL_SEC)
        {
            printf("📦 Sending %d messages to Kafka...\n", batch_count);

            for (int i = 0; i < batch_count; i++)
            {
                rd_kafka_resp_err_t err;

                err = rd_kafka_producev(
                    kafka_producer, 
                    RD_KAFKA_V_TOPIC(KAFKA_EVENTS_TOPIC), 
                    RD_KAFKA_V_KEY(batch[i].device, strlen(batch[i].device)), 
                    RD_KAFKA_V_VALUE(batch[i].payload, strlen(batch[i].payload)), 
                    RD_KAFKA_V_MSGFLAGS(RD_KAFKA_MSG_F_COPY), 
                    RD_KAFKA_V_END);

                if (err)
                {
                    fprintf(stderr, "❌ Produce failed: %s\n", rd_kafka_err2str(err));
                }
                else
                {
                    printf("📤 Queued message\n");
                }
            }
  
            printf("📊 Kafka out queue: %d\n", rd_kafka_outq_len(kafka_producer));

            batch_count = 0;

            last_flush_time = now;

            /* Backpressure */
            if (rd_kafka_outq_len(kafka_producer) > 100000)
            {
                fprintf(stderr, "⚠ Kafka queue overloaded\n"); 
                usleep(500000);
            }
        }
    }

    /* =====================================================
     * SHUTDOWN
     * ===================================================== */

    printf("🛑 Shutting down...\n");

    /* Final batch send */
    if (batch_count > 0)
    {
        printf("📦 Final send of %d messages...\n", batch_count);

        for (int i = 0; i < batch_count; i++)
        {
            rd_kafka_producev(
                kafka_producer, 
                RD_KAFKA_V_TOPIC(KAFKA_EVENTS_TOPIC), 
                RD_KAFKA_V_KEY( batch[i].device, strlen(batch[i].device)), 
                RD_KAFKA_V_VALUE( batch[i].payload, strlen(batch[i].payload)), 
                RD_KAFKA_V_MSGFLAGS(RD_KAFKA_MSG_F_COPY), 
                RD_KAFKA_V_END);
        }
    }

    /*
     * Final flush ONLY during shutdown
     */
    rd_kafka_flush(kafka_producer, 10000);

    /* Cleanup */
    free(batch);

    close(sockfd);

    cleanup();

    return 0;
}