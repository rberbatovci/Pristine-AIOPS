#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include "regex.h"
#include "config.h"
#include "bulk.h"
#include <time.h>

void process_kafka_message_loop(rd_kafka_t *rk) {
    rd_kafka_message_t *rkmessage;

    while (1) {
        rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage) continue;

        if (rkmessage->err) {
            fprintf(stderr, "[KAFKA ERROR] %s\n", rd_kafka_message_errstr(rkmessage));
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        char *payload = malloc(rkmessage->len + 1);
        if (!payload) {
            fprintf(stderr, "[ERROR] Memory allocation failed\n");
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        memcpy(payload, rkmessage->payload, rkmessage->len);
        payload[rkmessage->len] = '\0';

        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);
        if (!root) {
            fprintf(stderr, "[ERROR] Failed to parse JSON: %s\n", error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        // Rename sysUpTimeInstance → sysUpTime
        json_t *uptime_val = json_object_get(root, "DISMAN-EXPRESSION-MIB::sysUpTimeInstance");
        if (uptime_val && json_is_string(uptime_val)) {
            json_object_set_new(root, "sysUpTime", json_string(json_string_value(uptime_val)));
            printf("[INFO] sysUpTimeInstance: %s\n", json_string_value(uptime_val));
        }

        // Rename snmpTrapOID.0 → snmpTrapOid
        json_t *trap_oid_val = json_object_get(root, "SNMPv2-MIB::snmpTrapOID.0");
        if (trap_oid_val && json_is_string(trap_oid_val)) {
            json_object_set_new(root, "snmpTrapOid", json_string(json_string_value(trap_oid_val)));
            printf("[INFO] snmpTrapOid: %s\n", json_string_value(trap_oid_val));
        }

        const char *device = json_string_value(json_object_get(root, "device"));

        const char *snmpTrapOidStr = json_string_value(trap_oid_val);
        SNMPTrapOID *trapOidInfo = findSnmpTrapOid(snmpTrapOidStr);
        if (trapOidInfo == NULL) {
            fprintf(stderr, "[ERROR] Could not load SNMP Trap OID: %s\n", snmpTrapOidStr);
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_object_del(root, "DISMAN-EXPRESSION-MIB::sysUpTimeInstance");
        json_object_del(root, "SNMPv2-MIB::snmpTrapOID.0");

        // Add timestamp
        time_t now = time(NULL);
        struct tm *tm_info = gmtime(&now);
        char timestamp[30];
        strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", tm_info);
        json_object_set_new(root, "timestamp", json_string(timestamp));

        // Get the content object
        json_t *content = json_object_get(root, "content");
        if (json_is_object(content)) {
            json_t *tags_array = json_array();

            pthread_mutex_lock(&config_mutex);
            for (int i = 0; i < trapTagCount; ++i) {
                SNMPTrapTag tag = trapTags[i];

                for (int j = 0; j < tag.oid_count; ++j) {
                    const char *oid = tag.oids[j];
                    json_t *value = json_object_get(content, oid);

                    if (value) {
                        // Rename content key from OID → tag name if not already set
                        if (!json_object_get(content, tag.name)) {
                            json_object_set(content, tag.name, value);
                        }

                        // Remove original OID key
                        json_object_del(content, oid);

                        // Add tag name to tags array
                        json_array_append_new(tags_array, json_string(tag.name));
                        break; // Avoid duplicate tag entries
                    }
                }
            }
            pthread_mutex_unlock(&config_mutex);

            if (json_array_size(tags_array) > 0) {
                json_object_set_new(root, "tags", tags_array);
            } else {
                json_decref(tags_array);
            }
        }

        // Print and buffer
        char *final_json = json_dumps(root, JSON_INDENT(2));
        printf("[DEBUG] Final JSON with metadata:\n%s\n", final_json);
        free(final_json);

        // Buffer for OpenSearch
        json_t *doc_copy = json_deep_copy(root);
        opensearch_buffer[opensearch_count++] = doc_copy;

        if (opensearch_count >= BULK_LIMIT) {
            send_bulk_to_opensearch(opensearch_buffer, opensearch_count);
            for (int i = 0; i < opensearch_count; i++) {
                json_decref(opensearch_buffer[i]);
            }
            opensearch_count = 0;
        }

        json_decref(root);
        free(payload);
        rd_kafka_message_destroy(rkmessage);
    }
}
