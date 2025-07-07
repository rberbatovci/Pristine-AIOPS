#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
#include <librdkafka/rdkafka.h>
#include <errno.h>
#include <signal.h>
#include <unistd.h>

#define KAFKA_BROKER "Kafka:9092"
#define KAFKA_TOPIC "syslog-topic"
#define UDP_PORT 1160
#define MAX_BUFFER 4096

// Global Kafka producer handle
static rd_kafka_t *rk = NULL;
static rd_kafka_topic_t *rkt = NULL;

// Syslog structure
typedef struct {
    char device[16];
    char message[MAX_BUFFER];
} SyslogMessage;

// Cleanup function
void cleanup() {
    if (rkt) {
        rd_kafka_topic_destroy(rkt);
        rkt = NULL;
    }
    
    if (rk) {
        // Wait for messages to be delivered
        rd_kafka_flush(rk, 10*1000); // Wait up to 10 seconds
        
        rd_kafka_destroy(rk);
        rk = NULL;
    }
}

// Signal termination handler
static void stop(int sig) {
    fprintf(stderr, "Terminating...\n");
    cleanup();
    exit(0);
}

// Initialize Kafka producer
void init_kafka_producer() {
    rd_kafka_conf_t *conf;
    char errstr[512];

    conf = rd_kafka_conf_new();
    
    if (rd_kafka_conf_set(conf, "bootstrap.servers", KAFKA_BROKER, errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "Failed to configure Kafka: %s\n", errstr);
        exit(1);
    }

    // Set the delivery report callback
    rd_kafka_conf_set_dr_msg_cb(conf, NULL);

    rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "Failed to create Kafka producer: %s\n", errstr);
        exit(1);
    }

    rkt = rd_kafka_topic_new(rk, KAFKA_TOPIC, NULL);
    if (!rkt) {
        fprintf(stderr, "Failed to create Kafka topic\n");
        cleanup();
        exit(1);
    }
}

// Function to send message to Kafka
void send_to_kafka(const char *message) {
    size_t len = strlen(message);
    int retry_count = 3;
    int retry_delay_ms = 100;
    int produce_status;

    while (retry_count-- > 0) {
        produce_status = rd_kafka_produce(
            rkt,
            RD_KAFKA_PARTITION_UA,
            RD_KAFKA_MSG_F_COPY,
            (void *)message,
            len,
            NULL, 0,
            NULL);

        if (produce_status == -1) {
            fprintf(stderr, "Failed to produce message: %s (retries left: %d)\n", 
                    rd_kafka_err2str(rd_kafka_last_error()), retry_count);
            if (retry_count > 0) {
                rd_kafka_poll(rk, retry_delay_ms);
                continue;
            }
            return;
        }
        break;
    }

    // Poll to handle delivery reports
    rd_kafka_poll(rk, 0);
}

void escape_json_string(const char *input, char *output, size_t output_size) {
    size_t j = 0;
    for (size_t i = 0; input[i] != '\0' && j + 6 < output_size; i++) {
        char c = input[i];
        switch (c) {
            case '\"': output[j++] = '\\'; output[j++] = '\"'; break;
            case '\\': output[j++] = '\\'; output[j++] = '\\'; break;
            case '\b': output[j++] = '\\'; output[j++] = 'b';  break;
            case '\f': output[j++] = '\\'; output[j++] = 'f';  break;
            case '\n': output[j++] = '\\'; output[j++] = 'n';  break;
            case '\r': output[j++] = '\\'; output[j++] = 'r';  break;
            case '\t': output[j++] = '\\'; output[j++] = 't';  break;
            default:
                if ((unsigned char)c < 0x20) {
                    j += snprintf(&output[j], output_size - j, "\\u%04x", c);
                } else {
                    output[j++] = c;
                }
        }
    }
    output[j] = '\0';
}

// Main function to read syslog over UDP and send it to Kafka
int main() {
    int sockfd;
    struct sockaddr_in server_addr, client_addr;
    socklen_t addr_len = sizeof(client_addr);
    char buffer[MAX_BUFFER];

    // Set up signal handlers
    signal(SIGINT, stop);
    signal(SIGTERM, stop);
    setbuf(stdout, NULL);
    setbuf(stderr, NULL);

    // Initialize Kafka producer once
    init_kafka_producer();

    // Create UDP socket
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("Socket creation failed");
        cleanup();
        exit(1);
    }

    // Set up UDP server address
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(UDP_PORT);
    server_addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(sockfd, (const struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Bind failed");
        cleanup();
        exit(1);
    }

    printf("Listening for syslogs on UDP port %d...\n", UDP_PORT);
    fflush(stdout);

    // Continuously read syslogs and send to Kafka
    while (1) {
        ssize_t recv_len = recvfrom(sockfd, buffer, MAX_BUFFER - 1, 0,
                                    (struct sockaddr *)&client_addr, &addr_len);
        if (recv_len < 0) {
            perror("recvfrom");
            continue;
        }

        buffer[recv_len] = '\0';  // Null-terminate the received message

        SyslogMessage syslog;
        strncpy(syslog.device, inet_ntoa(client_addr.sin_addr), sizeof(syslog.device) - 1);
        strncpy(syslog.message, buffer, sizeof(syslog.message) - 1);

        char escaped_message[MAX_BUFFER * 2];
        escape_json_string(syslog.message, escaped_message, sizeof(escaped_message));

        char json_message[MAX_BUFFER * 2];
        snprintf(json_message, sizeof(json_message),
                 "{\"device\":\"%s\",\"message\":\"%s\"}",
                 syslog.device, escaped_message);
        
        printf("Received from %s: %s\n", syslog.device, syslog.message);
        printf("Produced message: %s\n", json_message);
        fflush(stdout); 
        
        if (rd_kafka_produce(rkt, RD_KAFKA_PARTITION_UA,
                             RD_KAFKA_MSG_F_COPY,
                             json_message, strlen(json_message),
                             NULL, 0, NULL) == -1) {
            fprintf(stderr, "Failed to produce message: %s\n", rd_kafka_err2str(rd_kafka_last_error()));
        }

        rd_kafka_poll(rk, 0);  // Serve delivery reports
    }

    // Clean up (never reached in this example)
    rd_kafka_flush(rk, 10 * 1000);
    rd_kafka_topic_destroy(rkt);
    rd_kafka_destroy(rk);
    close(sockfd);
    return 0;
}