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
#define KAFKA_BROKER "Kafka:9092"
#define KAFKA_TOPIC "trap-topic"
#define KAFKA_DEBUG 0
#define NETSNMP_DEBUG 0

// Global Kafka producer handle
rd_kafka_t *kafka_producer = NULL;

// Helper function to convert hex string to binary
static int hex_to_binary(unsigned char **out, size_t max_len, const char *hex) {
    size_t hex_len = strlen(hex);
    if (hex_len % 2 != 0 || hex_len > max_len * 2) {
        return -1;
    }

    *out = (unsigned char *)malloc(hex_len / 2);
    if (*out == NULL) {
        return -1;
    }

    for (size_t i = 0; i < hex_len / 2; i++) {
        sscanf(hex + 2*i, "%2hhx", *out + i);
    }

    return hex_len / 2;
}

// Initialize Kafka producer
int initialize_kafka_producer() {
    char errstr[512];
    
    // Create configuration object
    rd_kafka_conf_t *conf = rd_kafka_conf_new();
    
    // Set bootstrap servers
    if (rd_kafka_conf_set(conf, "bootstrap.servers", KAFKA_BROKER,
                          errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "Kafka config error: %s\n", errstr);
        rd_kafka_conf_destroy(conf);
        return -1;
    }
    
    // Create producer instance
    kafka_producer = rd_kafka_new(RD_KAFKA_PRODUCER, conf,
                                 errstr, sizeof(errstr));
    if (!kafka_producer) {
        fprintf(stderr, "Failed to create Kafka producer: %s\n", errstr);
        return -1;
    }
    
    if (KAFKA_DEBUG) printf("✅ Kafka producer initialized\n");
    return 0;
}

// Clean up Kafka producer
void cleanup_kafka_producer() {
    if (kafka_producer) {
        // Wait for outstanding messages to be delivered
        rd_kafka_flush(kafka_producer, 10*1000); // 10 second timeout
        
        // Destroy the producer
        rd_kafka_destroy(kafka_producer);
        kafka_producer = NULL;
    }
}

void send_trap_to_kafka(netsnmp_pdu *pdu, const char *device) {
    if (!kafka_producer || !pdu) return;

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

    for (vars = pdu->variables; vars && remaining > 0; vars = vars->next_variable) {
        // Create OID string
        char oid_buf[256];
        snprint_objid(oid_buf, sizeof(oid_buf), vars->name, vars->name_length);

        // Create value string
        char value_buf[256];
        snprint_value(value_buf, sizeof(value_buf), vars->name, vars->name_length, vars);

        // Handle Timeticks
        if (vars->type == ASN_TIMETICKS) {
            char *time_part = strchr(value_buf, '(');
            if (time_part) {
                time_part = strchr(time_part, ')');
                if (time_part && *(time_part+2)) {
                    strncpy(value_buf, time_part+2, sizeof(value_buf));
                    value_buf[sizeof(value_buf)-1] = '\0';
                }
            }
        } else {
            char *colon = strchr(value_buf, ':');
            if (colon && *(colon+2)) {
                strncpy(value_buf, colon+2, sizeof(value_buf));
                value_buf[sizeof(value_buf)-1] = '\0';
            }
        }

        // Strip quotes
        char *quote = strchr(value_buf, '"');
        if (quote) {
            memmove(quote, quote+1, strlen(quote));
            char *end_quote = strchr(quote, '"');
            if (end_quote) *end_quote = '\0';
        }

        // Decide where to put this field
        if (strstr(oid_buf, "sysUpTimeInstance") || strstr(oid_buf, "snmpTrapOID.0")) {
            // Add directly as top-level field
            written = snprintf(ptr, remaining,
                ",\"%s\":\"%s\"",
                oid_buf, value_buf);
            ptr += written;
            remaining -= written;
        } else {
            // Add to content object
            if (!content_started) {
                written = snprintf(ptr, remaining, ",\"content\":{");
                ptr += written;
                remaining -= written;
                content_started = 1;
            } else {
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

    if (content_started) {
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
        RD_KAFKA_V_TOPIC(KAFKA_TOPIC),
        RD_KAFKA_V_VALUE(json_buffer, strlen(json_buffer)),
        RD_KAFKA_V_END);

    if (err) {
        fprintf(stderr, "❌ Failed to produce to topic %s: %s\n",
                KAFKA_TOPIC, rd_kafka_err2str(err));
    } else if (KAFKA_DEBUG) {
        printf("📤 Sent trap to Kafka: %s\n", json_buffer);
    }
}

// Callback function to process traps
int trap_callback(int operation, netsnmp_session *sp, int reqid,
    netsnmp_pdu *pdu, void *magic) {
    netsnmp_variable_list *vars;

    if (operation == NETSNMP_CALLBACK_OP_RECEIVED_MESSAGE) {
        printf("\n📥 Received SNMP Trap:\n");

        if (pdu == NULL) {
            printf("❌ Received PDU is NULL!\n");
        } else {
            printf("✅ PDU received: %d variables\n", pdu->variables ? 1 : 0);
        }

        char device[INET6_ADDRSTRLEN] = "unknown";
        if (pdu->transport_data && pdu->transport_data_length >= sizeof(netsnmp_indexed_addr_pair)) {
            netsnmp_indexed_addr_pair *iap = (netsnmp_indexed_addr_pair *)pdu->transport_data;
            
            if (iap->remote_addr.sa.sa_family == AF_INET) {
                struct sockaddr_in *sin = (struct sockaddr_in *)&iap->remote_addr.sa;
                inet_ntop(AF_INET, &sin->sin_addr, device, sizeof(device));
            } else if (iap->remote_addr.sa.sa_family == AF_INET6) {
                struct sockaddr_in6 *sin6 = (struct sockaddr_in6 *)&iap->remote_addr.sa;
                inet_ntop(AF_INET6, &sin6->sin6_addr, device, sizeof(device));
            }
        }

        printf("Source IP: %s\n", device);

        // Send trap to Kafka
        send_trap_to_kafka(pdu, device);
    }

    return 1;
}

int main(int argc, char **argv) {
    netsnmp_session session, *ss;
    netsnmp_transport *transport = NULL;
    int exit_status = 0;

    // Initialize Kafka producer
    if (initialize_kafka_producer() != 0) {
        fprintf(stderr, "⚠️ Continuing without Kafka support\n");
    }

    // Initialize SNMP library
    setenv("MIBS", "ALL", 1);
    setenv("MIBDIRS", "/app/traps/mibs", 1);
    init_snmp("consumer");
    snmp_enable_stderrlog();
    snmp_set_do_debugging(0);

    init_mib();
    read_all_mibs();

    // Set up SNMP session
    snmp_sess_init(&session);
    session.version = SNMP_VERSION_3;

    // Security parameters
    char *authPass = "AuTH_P@55w0rd123!";
    char *privPass = "PrIV@TE_P@55w0rd456!";
    char *username = "SNMPv3";
    const char *contextEngineIDStr = "800000090300500000030000";

    // Convert hex string to binary for securityEngineID
    unsigned char *engineID = NULL;
    int engineIDLen = hex_to_binary(&engineID, 32, contextEngineIDStr);
    if (engineIDLen < 0) {
        fprintf(stderr, "Error converting securityEngineID from hex.\n");
        exit_status = 1;
        goto cleanup;
    }

    session.securityName = (u_char *)username;
    session.securityNameLen = strlen(username);
    session.securityLevel = SNMP_SEC_LEVEL_AUTHPRIV;
    session.securityEngineID = engineID;
    session.securityEngineIDLen = engineIDLen;

    // Set authentication protocol (SHA-1)
    session.securityAuthProto = usmHMACSHA1AuthProtocol;
    session.securityAuthProtoLen = USM_AUTH_PROTO_SHA_LEN;
    session.securityAuthKeyLen = USM_AUTH_KU_LEN;
    if (generate_Ku(session.securityAuthProto,
                     session.securityAuthProtoLen,
                     (u_char *)authPass, strlen(authPass),
                     session.securityAuthKey,
                     &session.securityAuthKeyLen) != SNMPERR_SUCCESS) {
        fprintf(stderr, "Error generating authentication key.\n");
        exit_status = 1;
        goto cleanup;
    }

    // Set privacy protocol (AES)
    session.securityPrivProto = usmAESPrivProtocol;
    session.securityPrivProtoLen = USM_PRIV_PROTO_AES_LEN;
    session.securityPrivKeyLen = USM_PRIV_KU_LEN;
    if (generate_Ku(session.securityAuthProto,
                     session.securityAuthProtoLen,
                     (u_char *)privPass, strlen(privPass),
                     session.securityPrivKey,
                     &session.securityPrivKeyLen) != SNMPERR_SUCCESS) {
        fprintf(stderr, "Error generating privacy key.\n");
        exit_status = 1;
        goto cleanup;
    }

    session.contextEngineID = engineID;
    session.contextEngineIDLen = engineIDLen;
    session.callback = trap_callback;
    session.callback_magic = NULL;

    // Open trap listener
    char *listen_addr = "udp:1161";
    transport = netsnmp_tdomain_transport(listen_addr, 1, "snmptrap");
    if (!transport) {
        fprintf(stderr, "❌ Failed to open SNMP trap listener on %s\n", listen_addr);
        perror("Error details");
        exit_status = 1;
        goto cleanup;
    }

    ss = snmp_add(&session, transport, NULL, NULL);
    if (!ss) {
        snmp_perror("snmp_add");
        exit_status = 1;
        goto cleanup;
    }

    printf("✅ Listening for SNMPv3 traps on %s...\n", listen_addr);

    while (1) {
        int fds = 0, block = 1, result;
        fd_set fdset;
        struct timeval timeout;

        FD_ZERO(&fdset);
        snmp_select_info(&fds, &fdset, &timeout, &block);

        result = select(fds + 1, &fdset, NULL, NULL, block ? NULL : &timeout);
        if (result > 0) {
            snmp_read(&fdset);
        } else if (result == 0) {
            snmp_timeout();
        } else {
            perror("select failed");
            break;
        }
    }

cleanup:
    if (engineID) free(engineID);
    if (ss) snmp_close(ss);
    cleanup_kafka_producer();
    SOCK_CLEANUP;
    return exit_status;
}