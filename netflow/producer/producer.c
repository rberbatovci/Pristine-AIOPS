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
#define DEBUG 0

#define MAX_BATCH_SIZE 1000
#define FLUSH_INTERVAL_SEC 5

#define EXPIRATION_YEAR 2025
#define EXPIRATION_MONTH 11
#define EXPIRATION_DAY 3
#define EXPIRATION_HOUR 17
#define EXPIRATION_MINUTE 38

rd_kafka_t *rk = NULL;
rd_kafka_topic_t *rkt = NULL;
rd_kafka_conf_t *conf = NULL;

char *json_buffer[MAX_BATCH_SIZE];
size_t json_buffer_count = 0;
time_t last_flush_time = 0;

void flush_kafka_bulk() {
    if (json_buffer_count == 0) return;

    for (int i = 0; i < json_buffer_count; i++) {
        if (!json_buffer[i]) continue;

        rd_kafka_produce(
            rkt,
            RD_KAFKA_PARTITION_UA,
            RD_KAFKA_MSG_F_COPY,          // Kafka will copy the string
            json_buffer[i], strlen(json_buffer[i]),
            NULL, 0,
            NULL
        );

        rd_kafka_poll(rk, 0);  // Let Kafka handle delivery report

        free(json_buffer[i]);  // Free your malloc'd string
        json_buffer[i] = NULL;
    }

    json_buffer_count = 0;
}

typedef struct {
    uint16_t version;        // 9 for NetFlow v9
    uint16_t count;          // Number of records in this packet
    uint32_t sysUptime;      // Milliseconds since device boot
    uint32_t unix_secs;      // Seconds since 1970
    uint32_t unix_nsecs;     // Residual nanoseconds
    uint32_t flow_sequence;  // Sequence counter
    uint32_t source_id;      // Exporter identifier
} NetFlowV9Header;

typedef struct {
    uint16_t version;
    uint16_t length;
    uint32_t export_time;
    uint32_t sequence_number;
    uint32_t observation_id;
} IPFIXHeader;

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
    if (record->protocol != 6 && record->protocol != 17) {
        return NULL;
    }

    // Generate current time in ISO 8601 format
    char iso_time[30];
    time_t now = time(NULL);
    struct tm *gmt = gmtime(&now);
    strftime(iso_time, sizeof(iso_time), "%Y-%m-%dT%H:%M:%SZ", gmt);

    char *json = malloc(1200);  // slightly larger buffer
    if (!json) return NULL;

    snprintf(json, 1200,
        "{"
        "\"device\":\"%s\","
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
        "\"last_timestamp\":%lu,"
        "\"@timestamp\":\"%s\""
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
        record->last_timestamp,
        iso_time
    );

    return json;
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
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                   v1.1 beta                  ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
    printf("\n");
}

int get_udp_port()
{
    const char *env_port = getenv("NETFLOW_PORT");
    return env_port ? atoi(env_port) : 1162;
}

int main() {

    if (is_expired()) {
        fprintf(stderr, "⛔ Pristine-AIOPS v1.1 beta is out of date.\n Please contact the developer to get Pristine-AIOPS v1.2.\n");
        return 1;
    }

    setbuf(stdout, NULL);

    print_banner();

    int sockfd;
    struct sockaddr_in servaddr, cliaddr;
    socklen_t len;
    unsigned char buffer[BUFFER_SIZE];

    // UDP socket setup
    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("socket creation failed");
        exit(EXIT_FAILURE);
    }

    memset(&servaddr, 0, sizeof(servaddr));
    memset(&cliaddr, 0, sizeof(cliaddr));
    servaddr.sin_family = AF_INET;
    servaddr.sin_addr.s_addr = INADDR_ANY;
    int port = get_udp_port(); 
    servaddr.sin_port = htons(port);

    if (bind(sockfd, (const struct sockaddr *)&servaddr, sizeof(servaddr)) < 0) {
        perror("bind failed");
        close(sockfd);
        exit(EXIT_FAILURE);
    }

    printf("NetFlow/IPFIX listener started on port %d\n", port);

    // Kafka producer setup
    char errstr[512];
    conf = rd_kafka_conf_new();
    rd_kafka_conf_set(conf, "bootstrap.servers", "kafka:9092", errstr, sizeof(errstr));
    rk = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "%% Failed to create producer: %s\n", errstr);
        exit(EXIT_FAILURE);
    }

    rkt = rd_kafka_topic_new(rk, "netflow-events", NULL);
    if (!rkt) {
        fprintf(stderr, "%% Failed to create topic object\n");
        exit(EXIT_FAILURE);
    }

    last_flush_time = time(NULL);

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

        if (result != 0) {
            continue;
        }

        for (size_t i = 0; i < packet.record_count; i++) {
            char *record_json = flow_record_to_json(&packet.records[i], sender_ip_str);
            if (record_json != NULL) {
                //printf("[DEBUG] Record JSON: %s\n", record_json);

                if (json_buffer_count < MAX_BATCH_SIZE) {
                    json_buffer[json_buffer_count++] = strdup(record_json);
                }
            } 
        }

        time_t now = time(NULL);
        if (json_buffer_count >= MAX_BATCH_SIZE || (now - last_flush_time) >= FLUSH_INTERVAL_SEC) {
            flush_kafka_bulk();
        }

        if (packet.records != NULL) {
            free(packet.records);
        }

        if (is_expired()) {
            fprintf(stderr, "⛔ Pristine-AIOPS v1.1 beta is out of date.\n Please contact the developer to get Pristine-AIOPS v1.2.\n");
            break;
        }
    }

    // Cleanup
    close(sockfd);
    flush_kafka_bulk();
    rd_kafka_flush(rk, 1000);
    rd_kafka_topic_destroy(rkt);
    rd_kafka_destroy(rk);

    return 0;
}