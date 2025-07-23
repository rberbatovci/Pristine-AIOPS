#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <errno.h>

#include "netflow_parser.h"  // You should have this for NetFlowPacket, process_netflow_v9 etc.
#include "kafka_producer.h"  // send_to_kafka(...)
#include "config.h"          // BUFFER_SIZE, PORT, DEBUG, etc.

int main() {
    int sockfd;
    struct sockaddr_in servaddr, cliaddr;
    socklen_t len;
    unsigned char buffer[BUFFER_SIZE];

    // Create UDP socket
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("socket creation failed");
        exit(EXIT_FAILURE);
    }

    memset(&servaddr, 0, sizeof(servaddr));
    memset(&cliaddr, 0, sizeof(cliaddr));

    servaddr.sin_family = AF_INET;
    servaddr.sin_addr.s_addr = INADDR_ANY;
    servaddr.sin_port = htons(PORT);

    // Bind the socket
    if (bind(sockfd, (const struct sockaddr *)&servaddr, sizeof(servaddr)) < 0) {
        perror("bind failed");
        close(sockfd);
        exit(EXIT_FAILURE);
    }

    printf("NetFlow/IPFIX listener started on port %d\n", PORT);

    while (1) {
        len = sizeof(cliaddr);
        ssize_t n = recvfrom(sockfd, buffer, BUFFER_SIZE, 0,
                             (struct sockaddr *)&cliaddr, &len);
        if (n < 0) {
            perror("recvfrom failed");
            continue;
        }

        char sender_ip_str[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &cliaddr.sin_addr, sender_ip_str, sizeof(sender_ip_str));

        if (DEBUG) {
            printf("\nDEBUG: Received %zd bytes from %s:%d\n",
                   n, sender_ip_str, ntohs(cliaddr.sin_port));
        }

        uint16_t version;
        memcpy(&version, buffer, 2);
        version = ntohs(version);

        if (version != 9) {
            fprintf(stderr, "Unsupported NetFlow version: %d\n", version);
            continue;
        }

        NetFlowPacket packet = {0};
        int result = process_netflow_v9(buffer, n, &packet);

        if (result == 0) {
            char json_array[65535] = "["; // Start of JSON array
            size_t current_length = 1;    // Account for opening bracket
            size_t valid_count = 0;

            for (size_t i = 0; i < packet.record_count; i++) {
                char *record_json = flow_record_to_json(&packet.records[i], sender_ip_str);

                if (record_json != NULL) {
                    size_t record_length = strlen(record_json);

                    if (current_length + record_length + 2 >= sizeof(json_array)) {
                        fprintf(stderr, "Error: JSON array buffer overflow\n");
                        free(record_json);
                        break;
                    }

                    if (valid_count > 0) {
                        strcat(json_array, ",");
                        current_length++;
                    }

                    strcat(json_array, record_json);
                    current_length += record_length;
                    valid_count++;

                    free(record_json);
                }
            }

            if (valid_count > 0) {
                if (current_length + 2 < sizeof(json_array)) {
                    strcat(json_array, "]");
                    send_to_kafka("netflow-events", json_array);
                } else {
                    fprintf(stderr, "Error: JSON array buffer overflow (closing bracket)\n");
                }
            } else {
                if (DEBUG) printf("DEBUG: No valid JSON records to send\n");
            }
        } else {
            if (DEBUG) printf("DEBUG: Failed to process packet\n");
        }

        if (packet.records != NULL) {
            free(packet.records);
        }
    }

    close(sockfd);
    return 0;
}
