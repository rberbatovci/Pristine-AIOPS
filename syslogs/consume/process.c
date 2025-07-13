#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include "regex.h"
#include "config.h"
#include "bulk.h"

// Assumes: opensearch_buffer[] and opensearch_count are declared globally
// Also assumes: send_bulk_to_opensearch(...) is defined elsewhere

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

        // Allocate and copy payload
        char *payload = malloc(rkmessage->len + 1);
        if (!payload) {
            fprintf(stderr, "[ERROR] Memory allocation failed\n");
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        memcpy(payload, rkmessage->payload, rkmessage->len);
        payload[rkmessage->len] = '\0';

        // Parse JSON
        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);
        if (!root) {
            fprintf(stderr, "[ERROR] Failed to parse JSON: %s\n", error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_t *message_field = json_object_get(root, "message");
        if (json_is_string(message_field)) {
            const char *msg_str = json_string_value(message_field);

            // Extract mnemonic
            char mnemonic[64];
            if (extract_mnemonic(msg_str, mnemonic, sizeof(mnemonic))) {
                json_object_set_new(root, "mnemonic", json_string(mnemonic));

                MnemonicInfo *mnemonic_found = findMnemonic(mnemonic);
                if (!mnemonic_found) {
                    fprintf(stderr, "[ERROR] findMnemonic failed for '%s'\n", mnemonic);
                } else {
                    json_object_set_new(root, "severity", json_string(mnemonic_found->severity));

                    int syslog_level = mnemonic_found->level;
                    int current_default;
                    pthread_mutex_lock(&severity_mutex);
                    current_default = signal_severity;
                    pthread_mutex_unlock(&severity_mutex);

                    if (syslog_level <= current_default && mnemonic_found->alert) {
                        printf("Sending to both kafka and opensearch\n");
                    } else {
                        printf("Sending only to opensearch\n");
                    }

                    // Extract regex tags
                    json_t *tags_object = json_object();
                    for (int i = 0; i < mnemonic_found->regex_count; i++) {
                        const char *regex_name = mnemonic_found->regexes[i];
                        Regex *r = get_mnemonic_regexes(regex_name);
                        if (!r) {
                            printf("[WARN] Regex not found: %s\n", regex_name);
                            continue;
                        }

                        char *extracted = extract_tags(r, msg_str);
                        if (r->tag && extracted) {
                            json_object_set_new(tags_object, r->tag, json_string(extracted));
                        }
                        free(extracted);
                    }

                    if (json_object_size(tags_object) > 0) {
                        json_object_set_new(root, "tags", tags_object);
                    } else {
                        json_decref(tags_object); // Cleanup if empty
                    }
                }
            } else {
                printf("[WARN] No mnemonic found in message: %s\n", msg_str);
            }

            // Extract LSN
            int lsn = extract_lsn(msg_str);
            if (lsn != -1) {
                json_object_set_new(root, "lsn", json_integer(lsn));
            }

            // Extract timestamp
            char timestamp[64];
            extract_timestamp(msg_str, timestamp, sizeof(timestamp));
            if (timestamp[0] != '\0') {
                json_object_set_new(root, "timestamp", json_string(timestamp));
            }
        }

        // Print and buffer the enriched JSON
        char *final_json = json_dumps(root, JSON_INDENT(2));
        printf("[DEBUG] Final JSON with metadata:\n%s\n", final_json);
        free(final_json);  // Always free dumped strings

        // Buffer a copy for OpenSearch
        json_t *doc_copy = json_deep_copy(root);
        opensearch_buffer[opensearch_count++] = doc_copy;

        // Send in bulk if threshold reached
        if (opensearch_count >= BULK_LIMIT) {
            send_bulk_to_opensearch(opensearch_buffer, opensearch_count);
            for (int i = 0; i < opensearch_count; i++) {
                json_decref(opensearch_buffer[i]);
            }
            opensearch_count = 0;
        }

        // Cleanup
        json_decref(root);   // root JSON
        free(payload);       // original payload
        rd_kafka_message_destroy(rkmessage);  // Kafka message
    }
}
