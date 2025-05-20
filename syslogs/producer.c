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

// Global Kafka producer handle
static rd_kafka_t *rk = NULL;
static rd_kafka_topic_t *rkt = NULL;

// Syslog structure
typedef struct {
    char device[16];
    char message[2048];
} Syslog;

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

// Main function to read syslog over UDP and send it to Kafka
int main() {
    int sockfd;
    struct sockaddr_in server_addr, client_addr;
    socklen_t addr_len = sizeof(client_addr);
    char buffer[2048];

    // Set up signal handlers
    signal(SIGINT, stop);
    signal(SIGTERM, stop);

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

    // Continuously read syslogs and send to Kafka
    while (1) {
        ssize_t len = recvfrom(sockfd, (char *)buffer, sizeof(buffer), 0, 
                             (struct sockaddr *)&client_addr, &addr_len);
        if (len < 0) {
            perror("Recvfrom failed");
            continue;
        }

        // Ensure null-termination
        buffer[len] = '\0';

        // Format syslog message
        Syslog syslog;
        inet_ntop(AF_INET, &client_addr.sin_addr, syslog.device, sizeof(syslog.device));
        strncpy(syslog.message, buffer, sizeof(syslog.message));
        syslog.message[sizeof(syslog.message) - 1] = '\0';

        // Convert syslog to JSON
        char json_message[4096]; // Larger buffer for JSON
        int required_len = snprintf(NULL, 0, "{\"device\":\"%s\",\"message\":\"%s\"}", 
                                   syslog.device, syslog.message);
        
        if (required_len >= (int)sizeof(json_message)) {
            fprintf(stderr, "Message too long to fit in json buffer. Truncating...\n");
            // Truncate the message to fit
            int max_msg_len = sizeof(json_message) - (required_len - strlen(syslog.message)) - 1;
            snprintf(json_message, sizeof(json_message), 
                    "{\"device\":\"%s\",\"message\":\"%.*s\"}", 
                    syslog.device, max_msg_len, syslog.message);
        } else {
            snprintf(json_message, sizeof(json_message), 
                    "{\"device\":\"%s\",\"message\":\"%s\"}", 
                    syslog.device, syslog.message);
        }

        // Send message to Kafka
        send_to_kafka(json_message);
        printf("Sent syslog from %s to Kafka topic '%s': %.*s\n", 
               syslog.device, KAFKA_TOPIC, 50, syslog.message); // Print first 50 chars
    }

    // Cleanup (should never reach here due to infinite loop)
    cleanup();
    close(sockfd);
    return 0;
}