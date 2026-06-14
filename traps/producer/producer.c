#include <net-snmp/net-snmp-config.h>
#include <net-snmp/net-snmp-includes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

// Kafka configuration
#define KAFKA_BROKER "kafka:9092"
#define KAFKA_EVENTS_TOPIC "trap-events"
#define KAFKA_DEBUG 0
#define NETSNMP_DEBUG 0

#define EXPIRATION_YEAR 2027
#define EXPIRATION_MONTH 4
#define EXPIRATION_DAY 18
#define EXPIRATION_HOUR 17
#define EXPIRATION_MINUTE 38


// Global Kafka producer handle
rd_kafka_t *kafka_producer = NULL;

// Helper function to convert hex string to binary
static int hex_to_binary(unsigned char **out, size_t max_len, const char *hex)
{
    size_t hex_len = strlen(hex);
    if (hex_len % 2 != 0 || hex_len > max_len * 2)
    {
        return -1;
    }

    *out = (unsigned char *)malloc(hex_len / 2);
    if (*out == NULL)
    {
        return -1;
    }

    for (size_t i = 0; i < hex_len / 2; i++)
    {
        sscanf(hex + 2 * i, "%2hhx", *out + i);
    }

    return hex_len / 2;
}
 

void delivery_report(rd_kafka_t *rk,
                     const rd_kafka_message_t *rkmessage,
                     void *opaque)
{
    if (rkmessage->err)
    {
        fprintf(stderr,
                "❌ Delivery failed: %s\n",
                rd_kafka_err2str(rkmessage->err));
    }
    else
    {
        if (KAFKA_DEBUG)
        {
            printf("✅ Message delivered to topic %s [%d] at offset %lld\n",
                   rd_kafka_topic_name(rkmessage->rkt),
                   rkmessage->partition,
                   (long long)rkmessage->offset);
        }
    }
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
 
    rd_kafka_conf_set(conf, "acks", "1", errstr, sizeof(errstr));

    ///rd_kafka_conf_set(conf, "enable.idempotence", "true", errstr, sizeof(errstr)); 
 
    rd_kafka_conf_set(conf, "compression.codec", "zstd", errstr, sizeof(errstr));
 
    rd_kafka_conf_set(conf, "linger.ms", "50", errstr, sizeof(errstr));

    rd_kafka_conf_set(conf, "batch.num.messages", "10000", errstr, sizeof(errstr));

    rd_kafka_conf_set(conf, "queue.buffering.max.messages", "100000", errstr, sizeof(errstr));
 
    rd_kafka_conf_set_dr_msg_cb(conf, delivery_report);
 
    kafka_producer = rd_kafka_new(RD_KAFKA_PRODUCER, conf, errstr, sizeof(errstr));

    if (!kafka_producer)
    {
        fprintf(stderr, "❌ Failed to create Kafka producer: %s\n", errstr); 
        exit(1);
    }

    printf("✅ Kafka producer initialized\n");

}

// Clean up Kafka producer
void cleanup_kafka_producer()
{
    if (kafka_producer)
    {
        // Wait for outstanding messages to be delivered
        rd_kafka_flush(kafka_producer, 10 * 1000); // 10 second timeout

        // Destroy the producer
        rd_kafka_destroy(kafka_producer);
        kafka_producer = NULL;
    }
}

void send_trap_to_kafka(netsnmp_pdu *pdu, const char *device)
{
    if (!kafka_producer || !pdu)
        return;

    // Create JSON buffer for the trap
    char json_buffer[8192];
    char *ptr = json_buffer;
    int remaining = sizeof(json_buffer);

    // Start JSON object with device
    int written = snprintf(ptr, remaining,
                           "{\"device\":\"%s\"",
                           device ? device : "unknown");
    ptr += written;
    remaining -= written;

    // Core fields (add these directly)
    netsnmp_variable_list *vars;
    int content_started = 0;

    for (vars = pdu->variables; vars && remaining > 0; vars = vars->next_variable)
    {
        // Create OID string
        char oid_buf[256];
        snprint_objid(oid_buf, sizeof(oid_buf), vars->name, vars->name_length);

        // Create value string
        char value_buf[256];
        snprint_value(value_buf, sizeof(value_buf), vars->name, vars->name_length, vars);

        // Handle Timeticks
        if (vars->type == ASN_TIMETICKS)
        {
            char *time_part = strchr(value_buf, '(');
            if (time_part)
            {
                time_part = strchr(time_part, ')');
                if (time_part && *(time_part + 2))
                {
                    strncpy(value_buf, time_part + 2, sizeof(value_buf));
                    value_buf[sizeof(value_buf) - 1] = '\0';
                }
            }
        }
        else
        {
            char *colon = strchr(value_buf, ':');
            if (colon && *(colon + 2))
            {
                strncpy(value_buf, colon + 2, sizeof(value_buf));
                value_buf[sizeof(value_buf) - 1] = '\0';
            }
        }

        // Strip quotes
        char *quote = strchr(value_buf, '"');
        if (quote)
        {
            memmove(quote, quote + 1, strlen(quote));
            char *end_quote = strchr(quote, '"');
            if (end_quote)
                *end_quote = '\0';
        }

        // Decide where to put this field
        if (strstr(oid_buf, "sysUpTimeInstance") || strstr(oid_buf, "snmpTrapOID.0"))
        {
            // Add directly as top-level field
            written = snprintf(ptr, remaining,
                               ",\"%s\":\"%s\"",
                               oid_buf, value_buf);
            ptr += written;
            remaining -= written;
        }
        else
        {
            // Add to content object
            if (!content_started)
            {
                written = snprintf(ptr, remaining, ",\"content\":{");
                ptr += written;
                remaining -= written;
                content_started = 1;
            }
            else
            {
                written = snprintf(ptr, remaining, ",");
                ptr += written;
                remaining -= written;
            }

            written = snprintf(ptr, remaining,
                               "\"%s\":\"%s\"",
                               oid_buf, value_buf);
            ptr += written;
            remaining -= written;
        }
    }

    if (content_started)
    {
        written = snprintf(ptr, remaining, "}");
        ptr += written;
        remaining -= written;
    }

    // Close JSON object
    snprintf(ptr, remaining, "}");

    // Send to Kafka
    rd_kafka_resp_err_t err;
    err = rd_kafka_producev(
        kafka_producer,
        RD_KAFKA_V_TOPIC(KAFKA_EVENTS_TOPIC),
        RD_KAFKA_V_VALUE(json_buffer, strlen(json_buffer)),
        RD_KAFKA_V_END);

    if (err)
    {
        fprintf(stderr, "❌ Failed to produce to topic %s: %s\n",
                KAFKA_EVENTS_TOPIC, rd_kafka_err2str(err));
    }
    else if (KAFKA_DEBUG)
    {
        printf("📤 Sent trap to Kafka: %s\n", json_buffer);
    }
}

// Callback function to process traps
int trap_callback(int operation, netsnmp_session *sp, int reqid,
                  netsnmp_pdu *pdu, void *magic)
{
    netsnmp_variable_list *vars;

    if (operation == NETSNMP_CALLBACK_OP_RECEIVED_MESSAGE)
    {

        if (pdu == NULL)
        {
            printf("❌ Received PDU is NULL!\n");
        }

        char device[INET6_ADDRSTRLEN] = "unknown";
        if (pdu->transport_data && pdu->transport_data_length >= sizeof(netsnmp_indexed_addr_pair))
        {
            netsnmp_indexed_addr_pair *iap = (netsnmp_indexed_addr_pair *)pdu->transport_data;

            if (iap->remote_addr.sa.sa_family == AF_INET)
            {
                struct sockaddr_in *sin = (struct sockaddr_in *)&iap->remote_addr.sa;
                inet_ntop(AF_INET, &sin->sin_addr, device, sizeof(device));
            }
            else if (iap->remote_addr.sa.sa_family == AF_INET6)
            {
                struct sockaddr_in6 *sin6 = (struct sockaddr_in6 *)&iap->remote_addr.sa;
                inet_ntop(AF_INET6, &sin6->sin6_addr, device, sizeof(device));
            }
        }

        printf("Received new SNMPv3 trap from: %s\n", device);

        // Send trap to Kafka
        send_trap_to_kafka(pdu, device);
    }

    return 1;
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
    printf("║        Welcome to Pristine-AIOPS v1.2        ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
}

int main(int argc, char **argv)
{
    print_banner();

    setbuf(stdout, NULL);

    if (is_expired())
    {
        fprintf(stderr,
                "⛔ Pristine-AIOPS v1.2 is out of date.\n"
                "Please contact the developer to get Pristine-AIOPS v1.3.\n");

        return 1;
    }

    netsnmp_session session, *ss = NULL;
    netsnmp_transport *transport = NULL;

    unsigned char *engineID = NULL;

    int exit_status = 0;

    /* =====================================================
     * Initialize Kafka Producer
     * ===================================================== */

    init_kafka_producer();

    create_topic_if_needed(kafka_producer);

    /* =====================================================
     * Initialize SNMP
     * ===================================================== */

    setenv("MIBS", "ALL", 1);
    setenv("MIBDIRS", "/app/traps/producer/mibs", 1);

    init_snmp("consumer");

    // snmp_enable_stderrlog();
    // snmp_set_do_debugging(1);

    init_mib();
    read_all_mibs();

    /* =====================================================
     * Setup SNMP Session
     * ===================================================== */

    snmp_sess_init(&session);

    session.version = SNMP_VERSION_3;

    /* =====================================================
     * Environment Variables
     * ===================================================== */

    char *authPass = getenv("SNMP_AUTH_PASS");
    char *privPass = getenv("SNMP_PRIV_PASS");
    char *username = getenv("SNMP_USERNAME");

    const char *contextEngineIDStr =
        getenv("SNMP_ENGINE_ID");

    if (!authPass || !privPass || !username || !contextEngineIDStr)
    {
        fprintf(stderr,
                "❌ Missing SNMP environment variables\n");

        exit_status = 1;
        goto cleanup;
    }

    /* =====================================================
     * Convert Engine ID
     * ===================================================== */

    engineID = NULL;

    int engineIDLen =
        hex_to_binary(&engineID,
                      32,
                      contextEngineIDStr);

    if (engineIDLen < 0)
    {
        fprintf(stderr,
                "❌ Error converting securityEngineID\n");

        exit_status = 1;
        goto cleanup;
    }

    /* =====================================================
     * SNMPv3 Security
     * ===================================================== */

    session.securityName = (u_char *)username;
    session.securityNameLen = strlen(username);

    session.securityLevel = SNMP_SEC_LEVEL_AUTHPRIV;

    session.securityEngineID = engineID;
    session.securityEngineIDLen = engineIDLen;

    /* =====================================================
     * Authentication (SHA1)
     * ===================================================== */

    session.securityAuthProto =
        usmHMACSHA1AuthProtocol;

    session.securityAuthProtoLen =
        USM_AUTH_PROTO_SHA_LEN;

    session.securityAuthKeyLen =
        USM_AUTH_KU_LEN;

    if (generate_Ku(session.securityAuthProto,
                    session.securityAuthProtoLen,
                    (u_char *)authPass,
                    strlen(authPass),
                    session.securityAuthKey,
                    &session.securityAuthKeyLen)
        != SNMPERR_SUCCESS)
    {
        fprintf(stderr,
                "❌ Error generating authentication key\n");

        exit_status = 1;
        goto cleanup;
    }

    /* =====================================================
     * Privacy (AES)
     * ===================================================== */

    session.securityPrivProto =
        usmAESPrivProtocol;

    session.securityPrivProtoLen =
        USM_PRIV_PROTO_AES_LEN;

    session.securityPrivKeyLen =
        USM_PRIV_KU_LEN;

    if (generate_Ku(session.securityAuthProto,
                    session.securityAuthProtoLen,
                    (u_char *)privPass,
                    strlen(privPass),
                    session.securityPrivKey,
                    &session.securityPrivKeyLen)
        != SNMPERR_SUCCESS)
    {
        fprintf(stderr,
                "❌ Error generating privacy key\n");

        exit_status = 1;
        goto cleanup;
    }

    /* =====================================================
     * Context
     * ===================================================== */

    session.contextEngineID = engineID;
    session.contextEngineIDLen = engineIDLen;

    session.callback = trap_callback;
    session.callback_magic = NULL;

    /* =====================================================
     * Trap Port
     * ===================================================== */

    char *trapPort = getenv("SNMP_TRAP_PORT");

    if (!trapPort)
    {
        trapPort = "1161";
    }

    char listen_addr[64];

    snprintf(listen_addr,
             sizeof(listen_addr),
             "udp:%s",
             trapPort);

    printf("🚀 Producer is listening for SNMPv3 traps on port %s...\n",
           trapPort);

    /* =====================================================
     * Create Transport
     * ===================================================== */

    transport =
        netsnmp_tdomain_transport(listen_addr,
                                  1,
                                  "snmptrap");

    if (!transport)
    {
        fprintf(stderr,
                "❌ Failed to open SNMP trap listener on %s\n",
                listen_addr);

        perror("Error details");

        exit_status = 1;
        goto cleanup;
    }

    /* =====================================================
     * Add SNMP Session
     * ===================================================== */

    ss = snmp_add(&session,
                  transport,
                  NULL,
                  NULL);

    if (!ss)
    {
        snmp_perror("snmp_add");

        exit_status = 1;
        goto cleanup;
    }

    /* =====================================================
     * Main Loop
     * ===================================================== */

    while (1)
    {
        /*
         * IMPORTANT:
         * Processes delivery callbacks,
         * retries,
         * internal Kafka queues
         */
        rd_kafka_poll(kafka_producer, 0);

        int fds = 0;
        int block = 1;
        int result;

        fd_set fdset;

        struct timeval timeout;

        FD_ZERO(&fdset);

        snmp_select_info(&fds,
                         &fdset,
                         &timeout,
                         &block);

        result = select(fds + 1,
                        &fdset,
                        NULL,
                        NULL,
                        block ? NULL : &timeout);

        if (result > 0)
        {
            snmp_read(&fdset);
        }
        else if (result == 0)
        {
            snmp_timeout();
        }
        else
        {
            perror("select failed");
            break;
        }

        if (is_expired())
        {
            fprintf(stderr,
                    "⛔ Pristine-AIOPS v1.2 is out of date.\n"
                    "Please contact the developer to get "
                    "Pristine-AIOPS v1.3.\n");

            break;
        }
    }

cleanup:

    /* =====================================================
     * Cleanup Kafka
     * ===================================================== */

    if (kafka_producer)
    {
        /*
         * Wait for queued messages
         * to be delivered
         */
        rd_kafka_flush(kafka_producer, 10000);

        cleanup_kafka_producer();
    }

    /* =====================================================
     * Cleanup SNMP
     * ===================================================== */

    if (engineID)
    {
        free(engineID);
    }

    if (ss)
    {
        snmp_close(ss);
    }

    SOCK_CLEANUP;

    return exit_status;
}