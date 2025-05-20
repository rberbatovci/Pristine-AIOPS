#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <librdkafka/rdkafka.h>

#define NETFLOW_PORT 1162
#define BUFFER_SIZE 1500

struct netflow_v9_header {
    uint16_t version;
    uint16_t count;
    uint32_t sys_uptime;
    uint32_t unix_secs;
    uint32_t sequence_number;
    uint32_t source_id;
};

// Kafka global producer
rd_kafka_t *rk;
rd_kafka_conf_t *conf;
char errstr[512];

void init_kafka(const char *brokers) {
    conf = rd_kafka_conf_new();

    // Set the bootstrap.servers config BEFORE creating the producer
    if (rd_kafka_conf_set(conf, "bootstrap.servers", brokers,
        errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "%% Error setting broker: %s\n", errstr);
        exit(1);
    }

    if (!(rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr)))) {
        fprintf(stderr, "%% Failed to create Kafka producer: %s\n", errstr);
        exit(1);
    }

    if (rd_kafka_brokers_add(rk, brokers) == 0) {
        fprintf(stderr, "%% No valid brokers specified\n");
        exit(1);
    }
}

void send_to_kafka(const char *topic, const char *json_data) {
    rd_kafka_produce(
        rd_kafka_topic_new(rk, topic, NULL),
        RD_KAFKA_PARTITION_UA,
        RD_KAFKA_MSG_F_COPY,
        (void *)json_data, strlen(json_data),
        NULL, 0,
        NULL
    );

    rd_kafka_poll(rk, 0); // serve delivery reports
}

void parse_flow_data(uint8_t *data, int length) {
    int offset = 0;
    while (offset + 37 <= length) {
        char src_ip[16], dst_ip[16];
        inet_ntop(AF_INET, data + offset, src_ip, sizeof(src_ip));
        inet_ntop(AF_INET, data + offset + 4, dst_ip, sizeof(dst_ip));
        uint8_t protocol = *(data + offset + 8);
        uint16_t src_port = ntohs(*(uint16_t *)(data + offset + 9));
        uint16_t dst_port = ntohs(*(uint16_t *)(data + offset + 11));
        uint32_t if_in = ntohl(*(uint32_t *)(data + offset + 13));
        uint32_t if_out = ntohl(*(uint32_t *)(data + offset + 17));
        uint32_t bytes = ntohl(*(uint32_t *)(data + offset + 21));
        uint32_t packets = ntohl(*(uint32_t *)(data + offset + 25));
        uint32_t ts_first = ntohl(*(uint32_t *)(data + offset + 29));
        uint32_t ts_last = ntohl(*(uint32_t *)(data + offset + 33));

        char json[1024];
        snprintf(json, sizeof(json),
            "{ \"src_ip\": \"%s\", \"src_port\": %u, \"dst_ip\": \"%s\", \"dst_port\": %u, "
            "\"protocol\": %u, \"input_interface\": %u, \"output_interface\": %u, "
            "\"bytes\": %u, \"packets\": %u, \"timestamp_first\": %u, \"timestamp_last\": %u }",
            src_ip, src_port, dst_ip, dst_port, protocol, if_in, if_out, bytes, packets, ts_first, ts_last
        );

        send_to_kafka("netflow-topic", json);

        offset += 37; // advance to next flow record
    }
}

int main() {
    int sock;
    struct sockaddr_in server_addr, client_addr;
    socklen_t addr_len = sizeof(client_addr);
    uint8_t buffer[BUFFER_SIZE];

    if ((sock = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("Socket creation failed");
        return 1;
    }

    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = INADDR_ANY;
    server_addr.sin_port = htons(NETFLOW_PORT);

    if (bind(sock, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) {
        perror("Bind failed");
        close(sock);
        return 1;
    }

    init_kafka("localhost:9092");  // or your Kafka broker IP

    printf("Listening for NetFlow v9 on port %d...\n", NETFLOW_PORT);

    while (1) {
        ssize_t len = recvfrom(sock, buffer, BUFFER_SIZE, 0, (struct sockaddr *)&client_addr, &addr_len);
        if (len < sizeof(struct netflow_v9_header)) {
            fprintf(stderr, "Packet too short\n");
            continue;
        }

        struct netflow_v9_header *header = (struct netflow_v9_header *)buffer;
        if (ntohs(header->version) != 9) {
            fprintf(stderr, "Not a NetFlow v9 packet\n");
            continue;
        }

        uint8_t *flowset = buffer + sizeof(struct netflow_v9_header);
        int flowset_len = len - sizeof(struct netflow_v9_header);
        parse_flow_data(flowset + 4, flowset_len - 4); // skip flowset header (ID + length)
    }

    rd_kafka_flush(rk, 1000); // wait for all messages to be delivered
    rd_kafka_destroy(rk);

    close(sock);
    return 0;
}
