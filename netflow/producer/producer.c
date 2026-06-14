#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <time.h>
#include <endian.h>
#include <librdkafka/rdkafka.h>
#include <signal.h>
#include <stdatomic.h>

#define BUFFER_SIZE 65535
#define DEBUG 0

#define MAX_BATCH_SIZE 6
#define FLUSH_INTERVAL_SEC 5

#define KAFKA_BROKER "kafka:9092"
#define KAFKA_EVENTS_TOPIC "netflow-events"

#define EXPIRATION_YEAR 2027
#define EXPIRATION_MONTH 4
#define EXPIRATION_DAY 18
#define EXPIRATION_HOUR 17
#define EXPIRATION_MINUTE 38

volatile sig_atomic_t running = 1;

rd_kafka_t *kafka_producer = NULL;
rd_kafka_topic_t *rkt = NULL;
rd_kafka_conf_t *conf = NULL;

char *json_buffer[MAX_BATCH_SIZE];
size_t json_buffer_count = 0;
time_t last_flush_time = 0;

// --- NetFlow Structs ---

typedef struct {
    uint16_t version;
    uint16_t count;
    uint32_t sysUptime;
    uint32_t unix_secs;
    uint32_t flow_sequence;
    uint32_t source_id;
} NetFlowV9Header;

typedef struct {
    uint32_t source_addr;
    uint32_t dest_addr;
    uint16_t source_port;
    uint16_t dest_port;
    uint8_t protocol;
    uint32_t input_snmp;
    uint32_t output_snmp;
    uint32_t bytes_count;
    uint32_t packets_count;
    uint32_t first_timestamp; // Changed to uint32_t to match NetFlow v9 standard (sys-uptime)
    uint32_t last_timestamp;  // Changed to uint32_t to match NetFlow v9 standard (sys-uptime)
} FlowRecord;

typedef struct {
    uint16_t type;
    uint16_t length;
} TemplateField;

typedef struct {
    uint16_t template_id;
    uint16_t field_count;
    uint32_t source_id; // Added Source ID for robust template management
    TemplateField *fields;
} TemplateRecord;

typedef struct {
    uint16_t flowset_id;
    uint16_t length;
} FlowSetHeader;

typedef struct {
    NetFlowV9Header header;
    FlowRecord *records;
    size_t record_count;
} NetFlowPacket;

// --- Static Template Definition ---

#define STATIC_TEMPLATE_ID 256  // A common starting ID for Data FlowSets (ID > 255)
#define CISCO_SOURCE_ID 0       // Assuming 0 as a default if not explicitly needed for static

// Fields from your Ansible configuration 'RECORDER':
#define STATIC_FIELD_COUNT 11
TemplateField static_fields[STATIC_FIELD_COUNT] = {
    {8, 4},   // match ipv4 source address
    {12, 4},  // match ipv4 destination address
    {7, 2},   // match transport source-port
    {11, 2},  // match transport destination-port
    {4, 1},   // match ipv4 protocol
    {10, 4},  // collect interface input
    {14, 4},  // collect interface output
    {1, 4},   // collect counter bytes
    {2, 4},   // collect counter packets
    {22, 4},  // collect timestamp sys-uptime first (32-bit/4 bytes)
    {21, 4}   // collect timestamp sys-uptime last (32-bit/4 bytes)
};

// --- Template Storage ---

#define MAX_TEMPLATES 64
TemplateRecord templates[MAX_TEMPLATES];
size_t template_count = 0;

// --- Helper Functions ---

void handle_sigint(int sig) {
    (void)sig;
    running = 0;
    printf("\n🛑 SIGINT received, shutting down gracefully...\n");
}

void flush_kafka_bulk() {
    if (json_buffer_count == 0)
        return;

    printf("📤 Flushing %zu NetFlow records to Kafka...\n", json_buffer_count);

    for (size_t i = 0; i < json_buffer_count; i++) {
        const char *record = json_buffer[i];
        if (!record) continue;

        if (rd_kafka_produce(
                rkt, RD_KAFKA_PARTITION_UA, RD_KAFKA_MSG_F_COPY,
                (void *)record, strlen(record),
                NULL, 0, NULL) != 0) {
            fprintf(stderr, "❌ Failed to produce message: %s\n",
                    rd_kafka_err2str(rd_kafka_last_error()));
        }

        free(json_buffer[i]);
        json_buffer[i] = NULL;
    }

    json_buffer_count = 0;
    rd_kafka_poll(kafka_producer, 100);
    last_flush_time = time(NULL);
}

// Corrected version of initialize_static_template
void initialize_static_template() {
    // Ensure static_fields array is correctly mapped to the router's RECORDER
    // Order MUST match the router:
    static_fields[0] = (TemplateField){4, 1};   // 1. match ipv4 protocol (Type 4, Length 1)
    static_fields[1] = (TemplateField){8, 4};   // 2. match ipv4 source address (Type 8, Length 4)
    static_fields[2] = (TemplateField){12, 4};  // 3. match ipv4 destination address (Type 12, Length 4)
    static_fields[3] = (TemplateField){7, 2};   // 4. match transport source-port (Type 7, Length 2)
    static_fields[4] = (TemplateField){11, 2};  // 5. match transport destination-port (Type 11, Length 2)
    static_fields[5] = (TemplateField){10, 4};  // 6. collect interface input (Type 10, Length 4)
    static_fields[6] = (TemplateField){14, 4};  // 7. collect interface output (Type 14, Length 4)
    static_fields[7] = (TemplateField){1, 4};   // 8. collect counter bytes (Type 1, Length 4)
    static_fields[8] = (TemplateField){2, 4};   // 9. collect counter packets (Type 2, Length 4)
    static_fields[9] = (TemplateField){22, 4};  // 10. collect timestamp sys-uptime first (Type 22, Length 4)
    static_fields[10] = (TemplateField){21, 4}; // 11. collect timestamp sys-uptime last (Type 21, Length 4)

    if (template_count >= MAX_TEMPLATES) {
        fprintf(stderr, "Template array full, cannot add static template.\n");
        return;
    }

    // Add static template for a default source ID (CISCO_SOURCE_ID=0)
    templates[template_count++] = (TemplateRecord){
        .template_id = STATIC_TEMPLATE_ID,
        .field_count = STATIC_FIELD_COUNT,
        .source_id = CISCO_SOURCE_ID,
        .fields = static_fields
    };

    // Add static template for the Source ID (65562) you observed in the logs
    // NetFlow Source IDs are often unique per router/domain.
    templates[template_count++] = (TemplateRecord){
        .template_id = STATIC_TEMPLATE_ID,
        .field_count = STATIC_FIELD_COUNT,
        .source_id = 65562, // Use the specific Source ID observed
        .fields = static_fields
    };

    printf("⭐ Initialized static template ID=%u with %u fields for Source IDs %u and %u\n", 
           STATIC_TEMPLATE_ID, STATIC_FIELD_COUNT, CISCO_SOURCE_ID, 65562);
}

// Forward declaration
char* flow_record_to_json(const FlowRecord *record, const char *sender_ip);

// -----------------------------------------------------
// ✅ GET TEMPLATE (helper)
// -----------------------------------------------------
TemplateRecord* get_template(uint16_t id, uint32_t src_id) {
    for (int i = 0; i < template_count; i++)
        if (templates[i].template_id == id && templates[i].source_id == src_id)
            return &templates[i];
    return NULL;
}

// -----------------------------------------------------
// ✅ PARSE TEMPLATE FLOWSET
// -----------------------------------------------------
void parse_template_flowset(const unsigned char *ptr, size_t len, uint32_t source_id) {
    const unsigned char *end = ptr + len;
    printf("  📋 Parsing template flowset (source_id=%u, len=%zu)\n", source_id, len);

    while (ptr + 4 <= end) {
        uint16_t template_id = ntohs(*(uint16_t*)ptr); ptr += 2;
        uint16_t field_count = ntohs(*(uint16_t*)ptr); ptr += 2;

        if (ptr + field_count * 4 > end) {
            printf("⚠️ Template field data truncated, skipping template ID=%u\n", template_id);
            break;
        }

        printf("    Template ID=%u, Field Count=%u\n", template_id, field_count);

        TemplateRecord *tmpl = get_template(template_id, source_id);
        TemplateField *fields = malloc(field_count * sizeof(TemplateField));
        if (!fields) { fprintf(stderr, "Memory allocation failed\n"); return; }

        for (int i = 0; i < field_count; i++) {
            fields[i].type = ntohs(*(uint16_t*)ptr); ptr += 2;
            fields[i].length = ntohs(*(uint16_t*)ptr); ptr += 2;
            printf("      Field %d: Type=%u, Length=%u\n", i+1, fields[i].type, fields[i].length);
        }

        if (tmpl) {
            free(tmpl->fields);
            tmpl->fields = fields;
            tmpl->field_count = field_count;
            printf("📋 Updated existing template ID=%u (SourceID=%u)\n", template_id, source_id);
        } else if (template_count < MAX_TEMPLATES) {
            templates[template_count++] = (TemplateRecord){template_id, field_count, source_id, fields};
            printf("📋 Registered new template ID=%u (SourceID=%u)\n", template_id, source_id);
        } else {
            printf("⚠️ Template table full — cannot register template ID=%u\n", template_id);
            free(fields);
        }
    }
}

// -----------------------------------------------------
// ✅ PARSE DATA FLOWSET
// -----------------------------------------------------
void parse_data_flowset(const unsigned char *ptr, size_t len, uint16_t flowset_id, const char *sender_ip, uint32_t source_id) {
    TemplateRecord *tmpl = get_template(flowset_id, source_id);
    if (!tmpl) {
        printf("⚠️ No template found for FlowSet ID=%u (SourceID=%u)\n", flowset_id, source_id);
        return;
    }

    printf("  🟢 Parsing data FlowSet ID=%u, len=%zu for SourceID=%u\n", flowset_id, len, source_id);

    const unsigned char *end = ptr + len;
    size_t record_len = 0;
    for (int i = 0; i < tmpl->field_count; i++)
        record_len += tmpl->fields[i].length;

    if (record_len == 0 || len < record_len) {
        printf("⚠️ Invalid record length=%zu for FlowSet ID=%u\n", record_len, flowset_id);
        return;
    }

    while (ptr + record_len <= end) {
        FlowRecord rec = {0};
        const unsigned char *rec_ptr = ptr;

        for (int i = 0; i < tmpl->field_count; i++) {
            uint16_t type = tmpl->fields[i].type;
            uint16_t flen = tmpl->fields[i].length;

            switch (type) {
                case 1: rec.bytes_count = ntohl(*(uint32_t*)rec_ptr); break;
                case 2: rec.packets_count = ntohl(*(uint32_t*)rec_ptr); break;
                case 4: rec.protocol = *rec_ptr; break;
                case 7: rec.source_port = ntohs(*(uint16_t*)rec_ptr); break;
                case 8: rec.source_addr = ntohl(*(uint32_t*)rec_ptr); break;
                case 10: rec.input_snmp = ntohl(*(uint32_t*)rec_ptr); break;
                case 11: rec.dest_port = ntohs(*(uint16_t*)rec_ptr); break;
                case 12: rec.dest_addr = ntohl(*(uint32_t*)rec_ptr); break;
                case 14: rec.output_snmp = ntohl(*(uint32_t*)rec_ptr); break;
                case 21: rec.last_timestamp = ntohl(*(uint32_t*)rec_ptr); break;
                case 22: rec.first_timestamp = ntohl(*(uint32_t*)rec_ptr); break;
                default:
                    // skip unknown
                    break;
            }
            rec_ptr += flen;
        }

        // ⭐ MAJOR CHANGE: Collect JSON into the bulk buffer
        if (json_buffer_count < MAX_BATCH_SIZE) {
            char *json = flow_record_to_json(&rec, sender_ip);
            if (json) {
                json_buffer[json_buffer_count++] = json;
                if (DEBUG) printf("Added record to buffer (count: %zu)\n", json_buffer_count); // Add this for visibility
            }
        } else {
            // If buffer is full, the main loop will flush it, but we log the drop for now
            printf("⚠️ JSON buffer full, skipping flow record.\n");
        } 
        ptr += record_len;
    }
}

// -----------------------------------------------------
// ✅ CONVERT FLOW RECORD TO JSON (FIXED)
// -----------------------------------------------------
char* flow_record_to_json(const FlowRecord *r, const char *sender_ip)
{
    struct in_addr src_addr_net, dst_addr_net;

    src_addr_net.s_addr = htonl(r->source_addr);
    dst_addr_net.s_addr = htonl(r->dest_addr);

    char src_ip_str[INET_ADDRSTRLEN];
    char dst_ip_str[INET_ADDRSTRLEN];

    if (inet_ntop(AF_INET,
                  &src_addr_net,
                  src_ip_str,
                  sizeof(src_ip_str)) == NULL)
    {
        strcpy(src_ip_str, "N/A");
    }

    if (inet_ntop(AF_INET,
                  &dst_addr_net,
                  dst_ip_str,
                  sizeof(dst_ip_str)) == NULL)
    {
        strcpy(dst_ip_str, "N/A");
    }

    // =====================================================
    // Generate ISO8601 UTC timestamp
    // =====================================================

    time_t now = time(NULL);

    struct tm *tm_info = gmtime(&now);

    char timestamp[64];

    strftime(timestamp,
             sizeof(timestamp),
             "%Y-%m-%dT%H:%M:%SZ",
             tm_info);

    // =====================================================
    // Build JSON
    // =====================================================

    char buf[1024];

    int len = snprintf(
        buf,
        sizeof(buf),

        "{"
        "\"@timestamp\":\"%s\","
        "\"device\":\"%s\","
        "\"protocol\":%u,"
        "\"source_ip\":\"%s\","
        "\"source_port\":%u,"
        "\"dest_ip\":\"%s\","
        "\"dest_port\":%u,"
        "\"bytes\":%u,"
        "\"packets\":%u,"
        "\"input_if\":%u,"
        "\"output_if\":%u,"
        "\"first_switched\":%u,"
        "\"last_switched\":%u"
        "}",

        timestamp,
        sender_ip,
        r->protocol,
        src_ip_str,
        r->source_port,
        dst_ip_str,
        r->dest_port,
        r->bytes_count,
        r->packets_count,
        r->input_snmp,
        r->output_snmp,
        r->first_timestamp,
        r->last_timestamp
    );

    if (len < 0 || len >= (int)sizeof(buf))
    {
        fprintf(stderr,
                "❌ JSON encoding error or buffer overflow.\n");

        return NULL;
    }

    return strdup(buf);
}

// -----------------------------------------------------
// ✅ PROCESS NETFLOW V9 PACKET
// -----------------------------------------------------
int process_netflow_v9(const unsigned char *data, size_t len, void *packet, const char *sender_ip) {
    if (len < sizeof(NetFlowV9Header)) return -1;

    const NetFlowV9Header *hdr = (const NetFlowV9Header*)data;

    // Convert header fields to host byte order
    NetFlowV9Header host_hdr = {
        .version = ntohs(hdr->version),
        .count = ntohs(hdr->count),
        .sysUptime = ntohl(hdr->sysUptime),
        .unix_secs = ntohl(hdr->unix_secs),
        .flow_sequence = ntohl(hdr->flow_sequence),
        .source_id = ntohl(hdr->source_id)
    };
 
    const unsigned char *ptr = data + sizeof(NetFlowV9Header);
    const unsigned char *end = data + len;

    while (ptr + 4 <= end) {
        const unsigned char *flowset_start = ptr;

        // Safe read of FlowSet header
        uint16_t raw_id, raw_length;
        memcpy(&raw_id, flowset_start, 2);
        memcpy(&raw_length, flowset_start + 2, 2);

        uint16_t flowset_id = ntohs(raw_id);
        uint16_t flowset_length = ntohs(raw_length);

        // Sanity check
        if (flowset_length < 4 || (flowset_start + flowset_length) > end) {
            printf("⚠️ Invalid FlowSet length (%u) or truncated packet, skipping...\n", flowset_length);
            break;
        }

        const unsigned char *flowset_data = flowset_start + 4;
        size_t flowset_data_len = flowset_length - 4;

        printf("  FlowSet ID=%u, Length=%u\n", flowset_id, flowset_length);

        if (flowset_id == 0)
            parse_template_flowset(flowset_data, flowset_data_len, host_hdr.source_id);
        else if (flowset_id > 255)
            parse_data_flowset(flowset_data, flowset_data_len, flowset_id, sender_ip, host_hdr.source_id);
        else
            printf("⚙️ Skipping Option FlowSet ID=%u\n", flowset_id);

        // Move to next flowset
        ptr = flowset_start + flowset_length;
    }

    return 0;
}

int is_expired() {
    time_t current_time = time(NULL);
    struct tm *now = gmtime(&current_time);

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
    printf("║        Welcome to Pristine-AIOPS v1.2        ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
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

    /* Bootstrap server */
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

    rkt = rd_kafka_topic_new(
        kafka_producer,
        KAFKA_EVENTS_TOPIC,
        NULL
    );

    if (!rkt)
    {
        fprintf(stderr, "❌ Failed to create Kafka topic object\n");
        exit(1);
    }

    printf("✅ Kafka producer initialized\n");
}

int setup_udp_socket() {
    int sockfd;
    struct sockaddr_in servaddr = {0};
    int port = getenv("NETFLOW_PORT") ? atoi(getenv("NETFLOW_PORT")) : 2055;

    if ((sockfd = socket(AF_INET, SOCK_DGRAM, 0)) < 0) {
        perror("socket creation failed");
        exit(EXIT_FAILURE);
    }

    servaddr.sin_family = AF_INET;
    servaddr.sin_addr.s_addr = INADDR_ANY;
    servaddr.sin_port = htons(port);

    if (bind(sockfd, (const struct sockaddr *)&servaddr, sizeof(servaddr)) < 0) {
        perror("bind failed");
        close(sockfd);
        exit(EXIT_FAILURE);
    }

    printf("✅ Listening for NetFlow/IPFIX packets on UDP port %d\n", port);
    return sockfd;
}

int main() {
    if (is_expired()) {
        fprintf(stderr, "⛔ Pristine-AIOPS v1.2 is out of date.\n Please contact the developer to get Pristine-AIOPS v1.3.\n");
        return 1;
    }
     
    setbuf(stdout, NULL);
    print_banner();
    signal(SIGINT, handle_sigint); 
     
    initialize_static_template();

    init_kafka_producer();

    create_topic_if_needed(kafka_producer);

    int sockfd = setup_udp_socket();

    unsigned char buffer[BUFFER_SIZE];
    struct sockaddr_in cliaddr;
    socklen_t len;
    last_flush_time = time(NULL);

    while (running) {
        len = sizeof(cliaddr);
        ssize_t n = recvfrom(sockfd, buffer, BUFFER_SIZE, 0, (struct sockaddr *)&cliaddr, &len);
        if (n < 0) continue;

        char sender_ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &cliaddr.sin_addr, sender_ip, sizeof(sender_ip));

        printf("📡 Received NetFlow data from %s (%zd bytes)\n", sender_ip, n);

        uint16_t version;
        memcpy(&version, buffer, 2);
        version = ntohs(version);

        if (version != 9) {
            fprintf(stderr, "⚠️ Unsupported NetFlow version: %d (skipped)\n", version);
            continue;
        }

        NetFlowPacket packet = {0};
        // Pass sender_ip to process_netflow_v9
        if (process_netflow_v9(buffer, n, &packet, sender_ip) != 0) {
            fprintf(stderr, "⚠️ Failed to parse NetFlow v9 packet from %s\n", sender_ip);
            continue;
        }

        time_t now = time(NULL);
        if (json_buffer_count >= MAX_BATCH_SIZE || (now - last_flush_time) >= FLUSH_INTERVAL_SEC)
            flush_kafka_bulk();

        rd_kafka_poll(kafka_producer, 0);

        if (is_expired()) {
            fprintf(stderr, "⛔ License expired during runtime.\n");
            break;
        }
    }

    printf("💾 Final flush before exit...\n");
    flush_kafka_bulk();
    rd_kafka_flush(kafka_producer, 3000);

    rd_kafka_topic_destroy(rkt);
    rd_kafka_destroy(kafka_producer);
    close(sockfd);

    printf("✅ Clean shutdown complete.\n");
    return 0;
}