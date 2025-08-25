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
#define MAX_MESSAGE_SIZE 2048
#define KAFKA_BROKER "kafka:9092"
#define KAFKA_EVENTS_TOPIC "syslog-events"

#define EXPIRATION_YEAR 2025
#define EXPIRATION_MONTH 11
#define EXPIRATION_DAY 3
#define EXPIRATION_HOUR 17
#define EXPIRATION_MINUTE 38

typedef struct
{
    char device[64];
    char message[MAX_BUFFER];
} SyslogMessage;

rd_kafka_t *rk;
rd_kafka_topic_t *rkt;
int running = 1;

void stop(int signum)
{
    running = 0;
}

int get_max_batch_size()
{
    const char *env_val = getenv("DATA_FLUSH_SIZE");
    return env_val ? atoi(env_val) : 100; // fallback default
}
int get_flush_interval()
{
    const char *env_val = getenv("DATA_FLUSH_INTERVAL");
    return env_val ? atoi(env_val) : 1; // fallback default
}

void cleanup()
{
    if (rkt)
        rd_kafka_topic_destroy(rkt);
    if (rk)
    {
        rd_kafka_flush(rk, 10 * 1000);
        rd_kafka_destroy(rk);
    }
}

void escape_json_string(const char *input, char *output, size_t out_size)
{
    size_t j = 0;
    for (size_t i = 0; input[i] != '\0' && j + 1 < out_size; i++)
    {
        if (input[i] == '"' || input[i] == '\\')
        {
            if (j + 2 >= out_size)
                break;
            output[j++] = '\\';
        }
        output[j++] = input[i];
    }
    output[j] = '\0';
}

void init_kafka_producer()
{
    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();
    rd_kafka_conf_set(conf, "bootstrap.servers", KAFKA_BROKER, errstr, sizeof(errstr));
    rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!rk)
    {
        fprintf(stderr, "%% Failed to create Kafka producer: %s\n", errstr);
        exit(1);
    }
    rkt = rd_kafka_topic_new(rk, KAFKA_EVENTS_TOPIC, NULL);
    if (!rkt)
    {
        fprintf(stderr, "%% Failed to create Kafka topic: %s\n", rd_kafka_err2str(rd_kafka_last_error()));
        exit(1);
    }
}

// Get UDP port from environment or default to 1160
int get_udp_port()
{
    const char *env_port = getenv("SYSLOG_PORT");
    return env_port ? atoi(env_port) : 1160;
}

int is_expired() {
    time_t current_time = time(NULL);
    struct tm *now = gmtime(&current_time);  // Use gmtime() for UTC or localtime() for local

    if ((now->tm_year + 1900) > EXPIRATION_YEAR ||
        ((now->tm_year + 1900) == EXPIRATION_YEAR && (now->tm_mon + 1) > EXPIRATION_MONTH) ||
        ((now->tm_year + 1900) == EXPIRATION_YEAR && (now->tm_mon + 1) == EXPIRATION_MONTH && now->tm_mday > EXPIRATION_DAY) ||
        ((now->tm_year + 1900) == EXPIRATION_YEAR && (now->tm_mon + 1) == EXPIRATION_MONTH &&
         now->tm_mday == EXPIRATION_DAY && now->tm_hour > EXPIRATION_HOUR) ||
        ((now->tm_year + 1900) == EXPIRATION_YEAR && (now->tm_mon + 1) == EXPIRATION_MONTH &&
         now->tm_mday == EXPIRATION_DAY && now->tm_hour == EXPIRATION_HOUR &&
         now->tm_min >= EXPIRATION_MINUTE)) {
        
        return 1;
    }

    return 0;
}

void print_banner() {
    printf("\n");
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                   v1.1 beta                  ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
}

int main()
{
    if (is_expired()) {
        fprintf(stderr, "⛔ Pristine-AIOPS v1.1 beta is out of date.\n Please contact the developer to get Pristine-AIOPS v1.2.\n");
        return 1;
    }

    print_banner();

    setbuf(stdout, NULL);
    int sockfd;
    struct sockaddr_in server_addr, client_addr;
    socklen_t addr_len = sizeof(client_addr);
    char buffer[MAX_BUFFER];

    signal(SIGINT, stop);
    signal(SIGTERM, stop);

    setbuf(stdout, NULL);
    setbuf(stderr, NULL);

    init_kafka_producer();

    int udp_port = get_udp_port();

    printf("🚀 Producer listening for syslogs on port %d...\n", udp_port);
    
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0)
    {
        perror("Socket creation failed");
        cleanup();
        exit(1);
    }

    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(udp_port);
    server_addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(sockfd, (const struct sockaddr *)&server_addr, sizeof(server_addr)) < 0)
    {
        perror("Bind failed");
        cleanup();
        exit(1);
    }

    
    int check_interval_seconds = 6000;
    int counter = 0;
    int FLUSH_INTERVAL_SEC = get_flush_interval();
    int MAX_BATCH_SIZE = get_max_batch_size();

    char **message_batch = malloc(MAX_BATCH_SIZE * sizeof(char *));
    if (!message_batch)
    {
        perror("Failed to allocate message batch");
        cleanup();
        exit(1);
    }
    for (int i = 0; i < MAX_BATCH_SIZE; ++i)
    {
        message_batch[i] = malloc(MAX_MESSAGE_SIZE);
        if (!message_batch[i])
        {
            perror("Failed to allocate message buffer");
            cleanup();
            exit(1);
        }
    }

    int batch_count = 0;
    time_t last_flush_time = time(NULL);

    while (running)
    {
        ssize_t recv_len = recvfrom(sockfd, buffer, MAX_BUFFER - 1, MSG_DONTWAIT,
                                    (struct sockaddr *)&client_addr, &addr_len);
        if (recv_len < 0)
        {
            usleep(100000); // 100ms
        }
        else
        {
            buffer[recv_len] = '\0';

            SyslogMessage syslog;
            strncpy(syslog.device, inet_ntoa(client_addr.sin_addr), sizeof(syslog.device) - 1);
            syslog.device[sizeof(syslog.device) - 1] = '\0';

            strncpy(syslog.message, buffer, sizeof(syslog.message) - 1);
            syslog.message[sizeof(syslog.message) - 1] = '\0';

            //printf("Received syslog from %s.\n", syslog.device);

            char escaped[MAX_BUFFER * 2];
            escape_json_string(syslog.message, escaped, sizeof(escaped));

            snprintf(message_batch[batch_count], MAX_MESSAGE_SIZE,
                     "{\"device\":\"%s\",\"message\":\"%s\"}",
                     syslog.device, escaped);

            batch_count++;
        }

        time_t now = time(NULL);
        if (batch_count >= MAX_BATCH_SIZE || difftime(now, last_flush_time) >= FLUSH_INTERVAL_SEC)
        {
            for (int i = 0; i < batch_count; ++i)
            {
                if (rd_kafka_produce(rkt, RD_KAFKA_PARTITION_UA,
                                     RD_KAFKA_MSG_F_COPY,
                                     message_batch[i], strlen(message_batch[i]),
                                     NULL, 0, NULL) == -1)
                {
                    fprintf(stderr, "Failed to produce message (final flush): %s\n", rd_kafka_err2str(rd_kafka_last_error()));
                }
                //else
                //{
                //    printf("Produced to Kafka (final flush): %s\n", message_batch[i]);
                //}
            }

            rd_kafka_poll(rk, 0);
            batch_count = 0;
            last_flush_time = now;
        }

        if (is_expired()) {
            fprintf(stderr, "⛔ Pristine-AIOPS v1.1 beta is out of date.\n Please contact the developer to get Pristine-AIOPS v1.2.\n");
            break;
        }
    }

    /*for (int i = 0; i < batch_count; ++i)
    {
        if (rd_kafka_produce(rkt, RD_KAFKA_PARTITION_UA,
                             RD_KAFKA_MSG_F_COPY,
                             message_batch[i], strlen(message_batch[i]),
                             NULL, 0, NULL) == -1)
        {
            fprintf(stderr, "Failed to produce message: %s\n", rd_kafka_err2str(rd_kafka_last_error()));
        }
        else
        {
            printf("Produced to Kafka: %s\n", message_batch[i]);
        }
    }
    rd_kafka_flush(rk, 10 * 1000);
    */

    close(sockfd);
    cleanup();
    for (int i = 0; i < MAX_BATCH_SIZE; ++i)
    {
        free(message_batch[i]);
    }
    free(message_batch);
    return 0;
}
