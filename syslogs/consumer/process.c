#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include <uuid/uuid.h>
#include "globals.h"

json_t *serialize_events(const SyslogEvent *event)
{
    if (!event)
        return NULL;

    json_t *j = json_object();
    if (!j)
        return NULL;

    json_object_set_new(j, "eventId", json_string(event->eventId));
    json_object_set_new(j, "device", json_string(event->device));
    json_object_set_new(j, "lsn", json_integer(event->lsn));
    json_object_set_new(j, "severity", json_string(event->severity));
    json_object_set_new(j, "mnemonic", json_string(event->mnemonic));
    json_object_set_new(j, "timestamp", json_string(event->timestamp));
    json_object_set_new(j, "message", json_string(event->message));

    if (event->tags && json_object_size(event->tags) > 0)
    {
        json_t *tags_copy = json_deep_copy(event->tags);
        json_object_set_new(j, "tags", tags_copy);
    }

    return j;
}

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

void process_message(rd_kafka_t *rk, rd_kafka_t *signal_producer)
{
    rd_kafka_message_t *rkmessage;
    static time_t last_flush_time = 0;

    while (1)
    {
        rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage)
            continue;

        if (rkmessage->err) {
            fprintf(stderr, "[KAFKA ERROR] %s\n", rd_kafka_message_errstr(rkmessage));
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        fprintf(stderr, "[DEBUG] Message received. Length: %zd\n", rkmessage->len);
        char *payload = strndup(rkmessage->payload, rkmessage->len);
        if (!payload) {
            fprintf(stderr, "[ERROR] Memory allocation failed for payload\n");
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        fprintf(stderr, "[DEBUG] Payload copied. Content:\n%s\n", payload);

        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);
        if (!root) {
            fprintf(stderr, "[ERROR] JSON parsing failed: %s\n", error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        fprintf(stderr, "[DEBUG] JSON parsed successfully\n");

        json_t *msg_field = json_object_get(root, "message");
        if (!json_is_string(msg_field)) {
            fprintf(stderr, "[ERROR] 'message' field is missing or not a string\n");
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        const char *msg_str = json_string_value(msg_field);
        fprintf(stderr, "[DEBUG] Extracted message field: %s\n", msg_str);

        SyslogEvent event = {0};
        uuid_t uuid;
        uuid_generate(uuid);
        uuid_unparse_lower(uuid, event.eventId);
        fprintf(stderr, "[DEBUG] Generated eventId: %s\n", event.eventId);

        json_t *device_field = json_object_get(root, "device");
        if (json_is_string(device_field)) {
            snprintf(event.device, sizeof(event.device), "%s", json_string_value(device_field));
            fprintf(stderr, "[DEBUG] Device field set: %s\n", event.device);
        }

        snprintf(event.message, sizeof(event.message), "%s", msg_str);

        fprintf(stderr, "[DEBUG] Extracting LSN...\n");
        event.lsn = extract_lsn(msg_str);
        fprintf(stderr, "[DEBUG] LSN extracted: %d\n", event.lsn);

        fprintf(stderr, "[DEBUG] Extracting timestamp...\n");
        extract_timestamp(msg_str, event.timestamp, sizeof(event.timestamp));
        fprintf(stderr, "[DEBUG] Timestamp extracted: %s\n", event.timestamp);

        char mnemonic[64] = {0};
        fprintf(stderr, "[DEBUG] Extracting mnemonic...\n");
        if (extract_mnemonic(msg_str, mnemonic, sizeof(mnemonic))) {
            fprintf(stderr, "[DEBUG] Mnemonic extracted: %s\n", mnemonic);
            snprintf(event.mnemonic, sizeof(event.mnemonic), "%s", mnemonic);

            MnemonicInfo *info = findMnemonic(mnemonic);
            if (info) {
                fprintf(stderr, "[DEBUG] Mnemonic info found. Severity: %s\n", info->severity);
                snprintf(event.severity, sizeof(event.severity), "%s", info->severity);

                event.tags = json_object();
                for (int i = 0; i < info->regex_count; i++) {
                    Regex *matched[10];  // up to 10 per regex name
                    int matched_count = get_mnemonic_regexes(info->regexes[i], matched, 10);

                    for (int j = 0; j < matched_count; j++) {
                        Regex *r = matched[j];
                        if (!r || !r->tag) continue;

                        char *val = extract_tags(r, msg_str);
                        if (val) {
                            json_object_set_new(event.tags, r->tag, json_string(val));
                            free(val);
                        }
                    }
                }

                json_t *event_json = serialize_events(&event);
                if (!event_json) {
                    fprintf(stderr, "[ERROR] Failed to serialize event\n");
                } else {
                    char *dump = json_dumps(event_json, JSON_INDENT(2));
                    fprintf(stderr, "[DEBUG] Serialized event JSON:\n%s\n", dump);
                    // free(dump); // optional, depending on usage

                    if (info->alert) {
                        fprintf(stderr, "[DEBUG] Alert enabled, sending to Kafka\n");
                        add_alert_to_kafka_bulk(event_json, signal_producer);
                    }

                    if (opensearch_events_count < DATA_FLUSH_SIZE) {
                        opensearch_events_buffer[opensearch_events_count++] = json_incref(event_json);
                    } else {
                        fprintf(stderr, "[INFO] Buffer full, flushing to OpenSearch\n");
                        send_bulk_to_opensearch(opensearch_events_buffer, opensearch_events_count);
                        for (int i = 0; i < opensearch_events_count; i++) {
                            json_decref(opensearch_events_buffer[i]);
                        }
                        opensearch_events_count = 0;
                        opensearch_events_buffer[opensearch_events_count++] = json_incref(event_json);
                    }

                    json_decref(event_json);
                }
            } else {
                fprintf(stderr, "[ERROR] No mnemonic info found for: %s\n", mnemonic);
            }
        } else {
            fprintf(stderr, "[DEBUG] No mnemonic extracted from message.\n");
        }

        if (event.tags) json_decref(event.tags);
        json_decref(root);
        free(payload);
        rd_kafka_commit_message(rk, rkmessage, 0);
        rd_kafka_message_destroy(rkmessage);
    }
}
