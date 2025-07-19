#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include "regex.h"
#include "config.h"
#include "bulk.h"
#include <uuid/uuid.h>

void process_message(rd_kafka_t *rk)
{
    rd_kafka_message_t *rkmessage;

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

        json_t *message_field = json_object_get(root, "message");
        if (json_is_string(message_field))
        {
            const char *msg_str = json_string_value(message_field);
            char mnemonic[64];

            if (extract_mnemonic(msg_str, mnemonic, sizeof(mnemonic)))
            {
                json_object_set_new(root, "mnemonic", json_string(mnemonic));

                MnemonicInfo *mnemonic_found = findMnemonic(mnemonic);
                if (!mnemonic_found)
                {
                    fprintf(stderr, "[ERROR] findMnemonic failed for '%s'\n", mnemonic);
                }
                else
                {
                    json_object_set_new(root, "severity", json_string(mnemonic_found->severity));

                    // Tag extraction via regex
                    json_t *tags_object = json_object();
                    for (int i = 0; i < mnemonic_found->regex_count; i++)
                    {
                        const char *regex_name = mnemonic_found->regexes[i];
                        Regex *r = get_mnemonic_regexes(regex_name);
                        if (!r)
                        {
                            printf("[WARN] Regex not found: %s\n", regex_name);
                            continue;
                        }

                        char *extracted = extract_tags(r, msg_str);
                        if (r->tag && extracted)
                        {
                            json_object_set_new(tags_object, r->tag, json_string(extracted));
                        }
                        free(extracted);
                    }

                    if (json_object_size(tags_object) > 0)
                    {
                        json_object_set_new(root, "tags", tags_object);
                    }
                    else
                    {
                        json_decref(tags_object);
                    }

                    // Add LSN and timestamp
                    int lsn = extract_lsn(msg_str);
                    if (lsn != -1)
                    {
                        json_object_set_new(root, "lsn", json_integer(lsn));
                    }

                    char timestamp[64];
                    extract_timestamp(msg_str, timestamp, sizeof(timestamp));
                    if (timestamp[0] != '\0')
                    {
                        json_object_set_new(root, "timestamp", json_string(timestamp));
                    }

                    uuid_t uuid;
                    char uuid_str[37];
                    uuid_generate(uuid);
                    uuid_unparse_lower(uuid, uuid_str);
                    json_object_set_new(root, "eventId", json_string(uuid_str));

                    // Dump to string
                    char *final_json = json_dumps(root, JSON_COMPACT);
                    if (!final_json)
                    {
                        fprintf(stderr, "[ERROR] Failed to dump enriched JSON\n");
                    }
                    else
                    {
                        printf("[DEBUG] Final JSON:\n%s\n", final_json);

                        // Send to Kafka if alert
                        if (mnemonic_found->alert)
                        {
                            printf("Sending to both kafka222 and opensearch\n");
                            add_alert_to_kafka_bulk(root); // send as string
                        }
                        else
                        {
                            printf("Sending only to opensearch\n");
                        }

                        free(final_json);
                    }
                }
            }
            else
            {
                printf("[WARN] No mnemonic found in message: %s\n", msg_str);
            }
        }

        // Buffer to OpenSearch
        opensearch_buffer[opensearch_count++] = json_deep_copy(root);

        if (opensearch_count >= BULK_LIMIT)
        {
            send_bulk_to_opensearch(opensearch_buffer, opensearch_count);
            for (int i = 0; i < opensearch_count; i++)
            {
                json_decref(opensearch_buffer[i]);
            }
            opensearch_count = 0;
        }

        json_decref(root);
        free(payload);
        rd_kafka_message_destroy(rkmessage);
    }
}
