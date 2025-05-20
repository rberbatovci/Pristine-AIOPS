#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <arpa/inet.h>
#include <librdkafka/rdkafka.h>
#include <errno.h>
#include <curl/curl.h>

#define KAFKA_BROKER "localhost:9092"
#define KAFKA_TOPIC "syslog-topic"
#define UDP_PORT 1160
#define OPENSEARCH_URL "http://localhost:9200/syslogs/_doc"

// Syslog structure
typedef struct {
    char device[16];
    char message[2048];
} Syslog;

// Function to send syslog data to OpenSearch
void send_to_opensearch(const char *json_message) {
    CURL *curl;
    CURLcode res;

    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();

    if(curl) {
        curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_message);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, "Content-Type: application/json");

        // Perform the request and check for errors
        res = curl_easy_perform(curl);

        if(res != CURLE_OK) {
            fprintf(stderr, "Failed to send data to OpenSearch: %s\n", curl_easy_strerror(res));
        } else {
            printf("Syslog data sent to OpenSearch: %s\n", json_message);
        }

        curl_easy_cleanup(curl);
    }
    curl_global_cleanup();
}

// Main function to read syslog over UDP and send it to Kafka
int main() {
    int sockfd;
    struct sockaddr_in server_addr, client_addr;
    socklen_t addr_len = sizeof(client_addr);
    char buffer[2048];

    // Create UDP socket
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("Socket creation failed");
        exit(1);
    }

    // Set up UDP server address
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(UDP_PORT);
    server_addr.sin_addr.s_addr = INADDR_ANY;

    if (bind(sockfd, (const struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Bind failed");
        exit(1);
    }

    printf("Listening for syslogs on UDP port %d...\n", UDP_PORT);

    // Continuously read syslogs and send to OpenSearch
    while (1) {
        ssize_t len = recvfrom(sockfd, (char *)buffer, sizeof(buffer), 0, (struct sockaddr *)&client_addr, &addr_len);
        if (len < 0) {
            perror("Recvfrom failed");
            continue;
        }

        // Format syslog message
        Syslog syslog;
        inet_ntop(AF_INET, &client_addr.sin_addr, syslog.device, sizeof(syslog.device));
        strncpy(syslog.message, buffer, sizeof(syslog.message));

        // Convert syslog to JSON
        char json_message[2048];
        int message_len = (int)(sizeof(syslog.message) - 1);
        int max_json_len = sizeof(json_message) - 1;
        
        int required_len = snprintf(NULL, 0, "{\"device\": \"%s\", \"message\": \"%.*s\"}", syslog.device, message_len, syslog.message);
        if (required_len >= max_json_len) {
            fprintf(stderr, "Message too long to fit in json buffer.\n");
            continue;
        }

        snprintf(json_message, sizeof(json_message), "{\"device\": \"%s\", \"message\": \"%.*s\"}", syslog.device, message_len, syslog.message);

        // Send message to OpenSearch
        send_to_opensearch(json_message);
        printf("Sent syslog from %s to OpenSearch: %s\n", syslog.device, syslog.message);
    }

    return 0; // Ensure main function returns 0 to indicate success
}
