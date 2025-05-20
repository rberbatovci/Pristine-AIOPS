#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <time.h>
#include <endian.h>
#include <librdkafka/rdkafka.h>

#define BUFFER_SIZE 65535
#define PORT 1162
#define DEBUG 1  // Set to 1 for debug output, 0 to disable

// NetFlow v9 Header Structure
typedef struct {
    uint16_t version;        // 9 for NetFlow v9
    uint16_t count;          // Number of records in this packet
    uint32_t sysUptime;      // Milliseconds since device boot
    uint32_t unix_secs;      // Seconds since 1970
    uint32_t unix_nsecs;     // Residual nanoseconds
    uint32_t flow_sequence;  // Sequence counter
    uint32_t source_id;      // Exporter identifier
} NetFlowV9Header;

// IPFIX (v10) Header Structure
typedef struct {
    uint16_t version;
    uint16_t length;
    uint32_t export_time;
    uint32_t sequence_number;
    uint32_t observation_id;
} IPFIXHeader;

// Common Flow Record Structure
typedef struct {
    uint32_t source_addr;
    uint32_t dest_addr;
    uint8_t protocol;
    uint16_t source_port;
    uint16_t dest_port;
    uint32_t input_snmp;
    uint32_t output_snmp;
    uint32_t bytes_count;
    uint32_t packets_count;
    uint64_t first_timestamp;
    uint64_t last_timestamp;
} FlowRecord;

typedef struct {
    uint16_t version;        // 9 or 10
    union {
        NetFlowV9Header v9;
        IPFIXHeader v10;
    } header;
    FlowRecord *records;
    size_t record_count;
} NetFlowPacket;

void print_ip_address(uint32_t ip) {
    printf("%d.%d.%d.%d", 
           (ip >> 24) & 0xff,
           (ip >> 16) & 0xff,
           (ip >> 8) & 0xff,
           ip & 0xff);
}

char* flow_record_to_json(const FlowRecord *record, const char *sender_ip) {
    // Only allow TCP (6) and UDP (17) packets
    if (record->protocol != 6 && record->protocol != 17) {
        if (DEBUG) printf("DEBUG: Skipping non-TCP/UDP flow with protocol %u\n", record->protocol);
        return NULL;  // Skip records that are not TCP or UDP
    }

    static char json[1024];

    snprintf(json, sizeof(json),
        "{"
        "\"sender_ip\":\"%s\","
        "\"source_addr\":\"%u.%u.%u.%u\","
        "\"source_port\":%u,"
        "\"dest_addr\":\"%u.%u.%u.%u\","
        "\"dest_port\":%u,"
        "\"protocol\":%u,"
        "\"input_snmp\":%u,"
        "\"output_snmp\":%u,"
        "\"bytes_count\":%u,"
        "\"packets_count\":%u,"
        "\"first_timestamp\":%lu,"
        "\"last_timestamp\":%lu"
        "}",
        sender_ip,
        (record->source_addr >> 24) & 0xFF, (record->source_addr >> 16) & 0xFF,
        (record->source_addr >> 8) & 0xFF, record->source_addr & 0xFF,
        record->source_port,
        (record->dest_addr >> 24) & 0xFF, (record->dest_addr >> 16) & 0xFF,
        (record->dest_addr >> 8) & 0xFF, record->dest_addr & 0xFF,
        record->dest_port,
        record->protocol,
        record->input_snmp,
        record->output_snmp,
        record->bytes_count,
        record->packets_count,
        record->first_timestamp,
        record->last_timestamp
    );

    return json;
}

void send_to_kafka(const char *topic_name, const char *json_message) {
    char errstr[512];
    rd_kafka_t *rk;         // Producer instance
    rd_kafka_conf_t *conf;  // Configuration

    conf = rd_kafka_conf_new();
    rd_kafka_conf_set(conf, "bootstrap.servers", "Kafka:9092", errstr, sizeof(errstr));

    rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "%% Failed to create producer: %s\n", errstr);
        return;
    }

    // Debug print of the JSON message being sent
    if (DEBUG) {
        printf("DEBUG: Sending JSON to Kafka topic '%s':\n%s\n", topic_name, json_message);
    }

    rd_kafka_resp_err_t err = rd_kafka_producev(
        rk,
        RD_KAFKA_V_TOPIC(topic_name),
        RD_KAFKA_V_MSGFLAGS(RD_KAFKA_MSG_F_COPY),
        RD_KAFKA_V_VALUE((void *)json_message, strlen(json_message)),
        RD_KAFKA_V_END
    );

    if (err) {
        fprintf(stderr, "%% Failed to produce message: %s\n", rd_kafka_err2str(err));
    } else {
        rd_kafka_poll(rk, 0);  // Serve delivery reports
    }

    rd_kafka_flush(rk, 1000); // Wait for all messages to be delivered
    rd_kafka_destroy(rk);     // Destroy producer instance
}

int process_data_records(const unsigned char *data, size_t data_len, FlowRecord **records, size_t *record_count) {
    const size_t record_size = 45; // Size of our FlowRecord structure
    
    if (data_len < record_size) {
        if (DEBUG) printf("DEBUG: Data length %zu too small for even one record (%zu)\n", data_len, record_size);
        *records = NULL;
        *record_count = 0;
        return 0;
    }
    
    size_t max_records = data_len / record_size;
    
    if (DEBUG) printf("DEBUG: Attempting to allocate %zu records (%zu bytes)\n", 
                    max_records, max_records * sizeof(FlowRecord));
    
    *records = malloc(max_records * sizeof(FlowRecord));
    if (*records == NULL) {
        perror("malloc failed");
        if (DEBUG) printf("DEBUG: Failed to allocate %zu bytes for %zu records\n", 
                        max_records * sizeof(FlowRecord), max_records);
        return -1;
    }
    
    size_t count = 0;
    for (size_t i = 0; i < max_records; i++) {
        const unsigned char *record_data = data + (i * record_size);
        FlowRecord *record = &(*records)[count];
        
        memcpy(&record->source_addr, record_data, 4);
        record_data += 4;
        memcpy(&record->dest_addr, record_data, 4);
        record_data += 4;
        record->protocol = *record_data++;
        memcpy(&record->source_port, record_data, 2);
        record_data += 2;
        memcpy(&record->dest_port, record_data, 2);
        record_data += 2;
        memcpy(&record->input_snmp, record_data, 4);
        record_data += 4;
        memcpy(&record->output_snmp, record_data, 4);
        record_data += 4;
        memcpy(&record->bytes_count, record_data, 4);
        record_data += 4;
        memcpy(&record->packets_count, record_data, 4);
        record_data += 4;
        memcpy(&record->first_timestamp, record_data, 8);
        record_data += 8;
        memcpy(&record->last_timestamp, record_data, 8);
        
        // Convert from network byte order to host byte order
        record->source_addr = ntohl(record->source_addr);
        record->dest_addr = ntohl(record->dest_addr);
        record->source_port = ntohs(record->source_port);
        record->dest_port = ntohs(record->dest_port);
        record->input_snmp = ntohl(record->input_snmp);
        record->output_snmp = ntohl(record->output_snmp);
        record->bytes_count = ntohl(record->bytes_count);
        record->packets_count = ntohl(record->packets_count);
        record->first_timestamp = be64toh(record->first_timestamp);
        record->last_timestamp = be64toh(record->last_timestamp);
        
        count++;
    }
    
    *record_count = count;
    if (DEBUG) printf("DEBUG: Successfully processed %zu records\n", count);
    return 0;
}

int process_netflow_v9(const unsigned char *data, size_t data_len, NetFlowPacket *packet) {
    if (data_len < sizeof(NetFlowV9Header)) {
        fprintf(stderr, "ERROR: Packet too small for NetFlow v9 header\n");
        return -1;
    }

    packet->version = 9;
    memcpy(&packet->header.v9, data, sizeof(NetFlowV9Header));
    
    // Convert to host byte order
    packet->header.v9.version = ntohs(packet->header.v9.version);
    packet->header.v9.count = ntohs(packet->header.v9.count);
    packet->header.v9.sysUptime = ntohl(packet->header.v9.sysUptime);
    packet->header.v9.unix_secs = ntohl(packet->header.v9.unix_secs);
    packet->header.v9.unix_nsecs = ntohl(packet->header.v9.unix_nsecs);
    packet->header.v9.flow_sequence = ntohl(packet->header.v9.flow_sequence);
    packet->header.v9.source_id = ntohl(packet->header.v9.source_id);

    // For NetFlow v9, we would normally process templates first
    // For this example, we'll just try to process the data portion
    size_t data_offset = sizeof(NetFlowV9Header);
    size_t records_len = data_len - data_offset;
    
    if (DEBUG) printf("DEBUG: Records length: %zu\n", records_len);
    
    if (process_data_records(data + data_offset, records_len, &packet->records, &packet->record_count) != 0) {
        return -1;
    }

    return 0;
}

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

        if (DEBUG) printf("\nDEBUG: Received %zd bytes from %s:%d\n",
                        n, sender_ip_str, ntohs(cliaddr.sin_port));

        NetFlowPacket packet = {0};
        uint16_t version;
        memcpy(&version, buffer, 2);
        version = ntohs(version);

        if (version != 9) {
            fprintf(stderr, "Unsupported NetFlow version: %d\n", version);
            continue;
        }

        int result = process_netflow_v9(buffer, n, &packet);

        if (result == 0) {
            char json_array[65535] = "["; // Opening bracket
            size_t current_length = 1;
            size_t valid_count = 0;

            for (size_t i = 0; i < packet.record_count; i++) {
                char *record_json = flow_record_to_json(&packet.records[i], sender_ip_str);

                if (record_json != NULL) {
                    size_t record_length = strlen(record_json);

                    if (current_length + record_length + 2 >= sizeof(json_array)) {
                        fprintf(stderr, "Error: JSON array buffer overflow\n");
                        break;
                    }

                    if (valid_count > 0) {
                        strcat(json_array, ",");
                        current_length++;
                    }

                    strcat(json_array, record_json);
                    current_length += record_length;
                    valid_count++;
                }
            }

            if (valid_count > 0) {
                if (current_length + 2 < sizeof(json_array)) {
                    strcat(json_array, "]");
                    send_to_kafka("netflow-topic", json_array);
                } else {
                    fprintf(stderr, "Error: JSON array buffer overflow (closing bracket)\n");
                }
            } else {
                // No valid records, do not send anything
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