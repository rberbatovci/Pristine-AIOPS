#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include <uuid/uuid.h>

#include "config.h"
#include "bulk.h"

#define KAFKA_BROKER "Kafka:9092"
#define KAFKA_EVENTS_TOPIC "trap-events"
#define KAFKA_SIGNALS_TOPIC "trap-signals"

// External Kafka producer (initialized in main)
extern rd_kafka_t *signal_producer;

void process_message(rd_kafka_t *rk, rd_kafka_t *signal_producer)
{
    static time_t last_flush_time = 0;

    while (1)
    {
        rd_kafka_message_t *rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage)
            continue;

        if (rkmessage->err)
        {
            fprintf(stderr, "[KAFKA ERROR] %s\n", rd_kafka_message_errstr(rkmessage));
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        char *payload = malloc(rkmessage->len + 1);
        if (!payload)
        {
            fprintf(stderr, "[ERROR] Memory allocation failed\n");
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        memcpy(payload, rkmessage->payload, rkmessage->len);
        payload[rkmessage->len] = '\0';

        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);
        if (!root)
        {
            fprintf(stderr, "[ERROR] Failed to parse JSON: %s\n", error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        // Rename sysUpTimeInstance → sysUpTime
        json_t *uptime_val = json_object_get(root, "DISMAN-EXPRESSION-MIB::sysUpTimeInstance");
        if (uptime_val && json_is_string(uptime_val))
        {
            json_object_set_new(root, "sysUpTime", json_string(json_string_value(uptime_val)));
            printf("[INFO] sysUpTimeInstance: %s\n", json_string_value(uptime_val));
        }

        // Rename snmpTrapOID.0 → snmpTrapOid
        json_t *trap_oid_val = json_object_get(root, "SNMPv2-MIB::snmpTrapOID.0");
        if (trap_oid_val && json_is_string(trap_oid_val))
        {
            json_object_set_new(root, "snmpTrapOid", json_string(json_string_value(trap_oid_val)));
            printf("[INFO] snmpTrapOid: %s\n", json_string_value(trap_oid_val));
        }

        const char *snmpTrapOidStr = json_string_value(trap_oid_val);
        SNMPTrapOID *trapOidInfo = findSnmpTrapOid(snmpTrapOidStr);
        if (!trapOidInfo)
        {
            fprintf(stderr, "[ERROR] Unknown SNMP Trap OID: %s\n", snmpTrapOidStr);
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        // Clean up unnecessary fields
        json_object_del(root, "DISMAN-EXPRESSION-MIB::sysUpTimeInstance");
        json_object_del(root, "SNMPv2-MIB::snmpTrapOID.0");

        // Add timestamp
        time_t now = time(NULL);
        struct tm *tm_info = gmtime(&now);
        char timestamp[30];
        strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", tm_info);
        json_object_set_new(root, "timestamp", json_string(timestamp));

        // Process tag mappings
        json_t *content = json_object_get(root, "content");
        if (json_is_object(content))
        {

            pthread_mutex_lock(&config_mutex);
            for (int i = 0; i < trapTagCount; ++i)
            {
                SNMPTrapTag tag = trapTags[i];
                for (int j = 0; j < tag.oid_count; ++j)
                {
                    const char *oid = tag.oids[j];
                    json_t *value = json_object_get(content, oid);
                    if (value)
                    {
                        if (!json_object_get(content, tag.name))
                        {
                            json_object_set(content, tag.name, value);
                        }
                        json_object_del(content, oid);
                        break;
                    }
                }
            }
            pthread_mutex_unlock(&config_mutex);
        }

        uuid_t uuid;
        char uuid_str[37];
        uuid_generate(uuid);
        uuid_unparse_lower(uuid, uuid_str);
        json_object_set_new(root, "eventId", json_string(uuid_str));

        char *final_json = json_dumps(root, JSON_INDENT(2));
        printf("[DEBUG] Final JSON with metadata:\n%s\n", final_json);
        free(final_json);

        if (trapOidInfo->alert)
        {
            printf("[INFO] Sending to Kafka 'trap-signals' topic.\n");
            add_alert_to_kafka_bulk(root);
        }

        if (opensearch_events_count < DATA_FLUSH_SIZE)
        {
            printf("[INFO] [PROCESS] New SNMPv3 trap added in the buffer...\n");
            opensearch_events_buffer[opensearch_events_count++] = json_deep_copy(root);
        }
        else
        {
            printf("[INFO] OpenSearch buffer full. Sending bulk...\n");
            send_bulk_to_opensearch(opensearch_events_buffer, opensearch_events_count);
            for (int i = 0; i < opensearch_events_count; i++)
            {
                json_decref(opensearch_events_buffer[i]);
            }
            opensearch_events_count = 0;
            opensearch_events_buffer[opensearch_events_count++] = json_deep_copy(root);
        }

        time_t current_time = time(NULL);
        if (current_time - last_flush_time >= DATA_FLUSH_INTERVAL)
        {
            printf("[INFO] Flush interval reached. Flushing buffers...\n");
            if (opensearch_events_count > 0)
            {
                printf("[INFO] Sending %d documents to OpenSearch.\n", opensearch_events_count);
                send_bulk_to_opensearch(opensearch_events_buffer, opensearch_events_count);
                for (int i = 0; i < opensearch_events_count; i++)
                {
                    json_decref(opensearch_events_buffer[i]);
                }
                opensearch_events_count = 0;
            }
            send_bulk_to_kafka();
            last_flush_time = current_time;
        }

        json_decref(root);
        free(payload);
        rd_kafka_message_destroy(rkmessage);
    }
}
