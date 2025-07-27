#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include "regex.h"
#include "config.h"
#include "bulk.h"
#include <uuid/uuid.h>
#include "process.h"

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

void process_message(rd_kafka_t *rk)
{
    rd_kafka_message_t *rkmessage;
    static time_t last_flush_time = 0;

    while (1)
    {
        rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage)
            continue;

        if (rkmessage->err)
        {
            fprintf(stderr, "[KAFKA ERROR] %s\n", rd_kafka_message_errstr(rkmessage));
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        char *payload = strndup(rkmessage->payload, rkmessage->len);
        if (!payload)
        {
            fprintf(stderr, "[ERROR] Memory allocation failed\n");
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);
        if (!root)
        {
            fprintf(stderr, "[ERROR] Failed to parse JSON: %s\n", error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_t *msg_field = json_object_get(root, "message");
        if (!json_is_string(msg_field))
        {
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        const char *msg_str = json_string_value(msg_field);

        SyslogEvent event = {0};
        uuid_t uuid;
        uuid_generate(uuid);
        uuid_unparse_lower(uuid, event.eventId);

        json_t *device_field = json_object_get(root, "device");
        if (json_is_string(device_field))
        {
            snprintf(event.device, sizeof(event.device), "%s", json_string_value(device_field));
        }

        snprintf(event.message, sizeof(event.message), "%s", msg_str);
        event.lsn = extract_lsn(msg_str);
        extract_timestamp(msg_str, event.timestamp, sizeof(event.timestamp));

        char mnemonic[64];
        if (extract_mnemonic(msg_str, mnemonic, sizeof(mnemonic)))
        {
            snprintf(event.mnemonic, sizeof(event.mnemonic), "%s", mnemonic);
            MnemonicInfo *info = findMnemonic(mnemonic);

            if (info)
            {
                snprintf(event.severity, sizeof(event.severity), "%s", info->severity);

                event.tags = json_object();
                for (int i = 0; i < info->regex_count; i++)
                {
                    Regex *r = get_mnemonic_regexes(info->regexes[i]);
                    if (!r)
                        continue;
                    char *val = extract_tags(r, msg_str);
                    if (r->tag && val)
                    {
                        json_object_set_new(event.tags, r->tag, json_string(val));
                    }
                    free(val);
                }

                // ✅ ONE serializer call for both Kafka and OpenSearch
                json_t *event_json = serialize_events(&event);
                if (!event_json)
                {
                    fprintf(stderr, "[ERROR] Failed to serialize event\n");
                }
                else
                {
                    char *dump = json_dumps(event_json, JSON_INDENT(2));
                    //printf("Serialized event JSON:\n%s\n", dump);
                    //free(dump);

                    if (info->alert)
                    {
                        add_alert_to_kafka_bulk(event_json); // uses json_incref()
                    }

                    // OpenSearch buffer logic
                    if (opensearch_count < DATA_FLUSH_SIZE)
                    {
                        opensearch_buffer[opensearch_count++] = json_incref(event_json);
                    }
                    else
                    {
                        send_bulk_to_opensearch(opensearch_buffer, opensearch_count);
                        for (int i = 0; i < opensearch_count; i++)
                        {
                            json_decref(opensearch_buffer[i]);
                        }
                        opensearch_count = 0;
                        opensearch_buffer[opensearch_count++] = json_incref(event_json);
                    }

                    json_decref(event_json); // decrement your reference after use
                }
            }
            else
            {
                fprintf(stderr, "[ERROR] No mnemonic info found for: %s\n", mnemonic);
            }
        }

        if (event.tags)
            json_decref(event.tags);
        json_decref(root);
        free(payload);
        rd_kafka_message_destroy(rkmessage);
    }
}
