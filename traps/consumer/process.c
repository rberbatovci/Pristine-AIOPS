#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include <uuid/uuid.h>
#include "globals.h"

void generate_uuid(char *uuid_str) {
    uuid_t uuid;
    uuid_generate(uuid);
    uuid_unparse(uuid, uuid_str);
}

void get_current_timestamp(char *buffer, size_t size) {
    time_t now = time(NULL);
    struct tm *tm_info = gmtime(&now);
    strftime(buffer, size, "%Y-%m-%dT%H:%M:%SZ", tm_info);
}

void create_trap_event(TrapEvent *event, const char *device, const char *sysUpTime,
                       const char *snmpTrapOid, json_t *content) {
    generate_uuid(event->eventId);
    strncpy(event->device, device, sizeof(event->device) - 1);
    strncpy(event->sysUpTime, sysUpTime, sizeof(event->sysUpTime) - 1);
    strncpy(event->snmpTrapOid, snmpTrapOid, sizeof(event->snmpTrapOid) - 1);
    get_current_timestamp(event->timestamp, sizeof(event->timestamp));
    event->content = content;
}

json_t *serialize_events(const TrapEvent *event) {
    json_t *root = json_object();
    json_object_set_new(root, "eventId", json_string(event->eventId));
    json_object_set_new(root, "device", json_string(event->device));
    json_object_set_new(root, "sysUpTime", json_string(event->sysUpTime));
    json_object_set_new(root, "snmpTrapOid", json_string(event->snmpTrapOid));
    json_object_set_new(root, "timestamp", json_string(event->timestamp));
    json_object_set(root, "content", event->content);
    return root;
}

const char *get_string_field_or(json_t *root, const char *key1, const char *key2) {

    fprintf(stderr, "[Debug] Extracting snmpTrapOid and sysUpTime\n");
    json_t *val = json_object_get(root, key1);
    if (!val && key2) {
        val = json_object_get(root, key2);
    }
    if (val && json_is_string(val)) {
        return json_string_value(val);
    }
    return NULL;
}

void process_message(rd_kafka_t *rk, rd_kafka_t *signal_producer)
{
    static time_t last_flush_time = 0;
    printf("[DEBUG] process_message loop entered\n");

    while (1)
    {
        rd_kafka_message_t *rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage) {
            //printf("[TRACE] No Kafka message received this poll.\n");
            continue;
        }

        if (rkmessage->err) {
            fprintf(stderr, "[KAFKA ERROR] %s\n", rd_kafka_message_errstr(rkmessage));
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        printf("[TRACE] Kafka message received. Length: %zu bytes\n", rkmessage->len);

        char *payload = malloc(rkmessage->len + 1);
        if (!payload) {
            fprintf(stderr, "[ERROR] Memory allocation failed for payload\n");
            rd_kafka_message_destroy(rkmessage);
            continue;
        }
        memcpy(payload, rkmessage->payload, rkmessage->len);
        payload[rkmessage->len] = '\0';

        printf("[DEBUG] Kafka Payload:\n%s\n", payload);

        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);
        if (!root) {
            fprintf(stderr, "[ERROR] JSON parsing failed at line %d: %s\n", error.line, error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_t *sysUpTime_val = json_object_get(root, "DISMAN-EXPRESSION-MIB::sysUpTimeInstance");
        if (sysUpTime_val && json_is_string(sysUpTime_val)) {
            json_object_set(root, "sysUpTime", sysUpTime_val);
            json_object_del(root, "DISMAN-EXPRESSION-MIB::sysUpTimeInstance");
        }

        // Rename SNMPv2-MIB::snmpTrapOID.0 → snmpTrapOid
        json_t *snmpTrapOid_val = json_object_get(root, "SNMPv2-MIB::snmpTrapOID.0");
        if (snmpTrapOid_val && json_is_string(snmpTrapOid_val)) {
            json_object_set(root, "snmpTrapOid", snmpTrapOid_val);
            json_object_del(root, "SNMPv2-MIB::snmpTrapOID.0");
        }

        const char *device = json_string_value(json_object_get(root, "device"));
        const char *sysUpTime = json_string_value(json_object_get(root, "sysUpTime"));
        const char *snmpTrapOid = json_string_value(json_object_get(root, "snmpTrapOid"));

        json_t *content = json_object_get(root, "content");
        if (!device || !sysUpTime || !snmpTrapOid || !content) {
            fprintf(stderr, "[ERROR] One or more required fields missing in JSON.\n");
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        TrapEvent event;
        printf("[TRACE] Creating TrapEvent...\n");
        create_trap_event(&event, device, sysUpTime, snmpTrapOid, content);

        json_object_set_new(root, "eventId", json_string(event.eventId));
        json_object_set_new(root, "timestamp", json_string(event.timestamp));



        printf("[TRACE] Looking up Trap OID info: %s\n", snmpTrapOid);
        SNMPTrapOID *info = findSnmpTrapOid(snmpTrapOid);
        if (info) {
            printf("[TRACE] Tagging fields...\n");
            pthread_mutex_lock(&config_mutex);
            for (int i = 0; i < trapTagCount; ++i) {
                SNMPTrapTag tag = trapTags[i];
                for (int j = 0; j < tag.oid_count; ++j) {
                    const char *oid = tag.oids[j];
                    json_t *value = json_object_get(content, oid);
                    if (value) {
                        if (!json_object_get(content, tag.name)) {
                            json_object_set(content, tag.name, value);
                        }
                        json_object_del(content, oid);
                        break;
                    }
                }
            }
            pthread_mutex_unlock(&config_mutex);

            json_t  *event_json = serialize_events(&event);
            if (!event_json) {
                fprintf(stderr, "[ERROR] TrapEvent serialization failed\n");
            } else {
                char *event_str = json_dumps(event_json, JSON_COMPACT);
                fprintf(stderr, "[DEBUG] Serialized event JSON:\n%s\n", event_str);

                if (info->alert) {
                    printf("[INFO] Alert trap detected. Sending to Kafka 'trap-signals' topic...\n");
                    add_alert_to_kafka_bulk(event_json, signal_producer);
                }

                printf("[TRACE] Handling OpenSearch buffer...\n");

                if (opensearch_events_count < DATA_FLUSH_SIZE) {
                    printf("[INFO] [BUFFER] Appending trap to OpenSearch buffer...\n");
                    opensearch_events_buffer[opensearch_events_count++] = json_deep_copy(event_json);
                } else {
                    printf("[INFO] OpenSearch buffer full (%d events). Sending bulk...\n", opensearch_events_count);
                    send_bulk_to_opensearch(opensearch_events_buffer, opensearch_events_count);
                    for (int i = 0; i < opensearch_events_count; i++) {
                        json_decref(opensearch_events_buffer[i]);
                    }
                    opensearch_events_count = 0;
                    opensearch_events_buffer[opensearch_events_count++] = json_deep_copy(event_json);
                }
                json_decref(event_json);
            }
        } else {
            fprintf(stderr, "[ERROR] Unknown SNMP Trap OID: %s\n", snmpTrapOid);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }
        free(payload);
        rd_kafka_commit_message(rk, rkmessage, 0);
        rd_kafka_message_destroy(rkmessage);
    }

    fprintf(stderr, "[WARN] Exiting process_message loop because run = 0\n");
}
