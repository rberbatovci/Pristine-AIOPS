#include "rules.h"
#include "process.h"
#include "activeSignals.h"
#include <string.h>
#include <stdio.h>
#include <jansson.h>
#include <librdkafka/rdkafka.h>

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

        json_t *snmpTrapOid_field = json_object_get(root, "snmpTrapOid");
        json_t *timestamp_field = json_object_get(root, "timestamp");
        json_t *device_field = json_object_get(root, "device");
        json_t *event_id_field = json_object_get(root, "eventId");
        const char *snmpTrapOid = json_string_value(snmpTrapOid_field);
        const char *device = json_string_value(device_field);
        const char *eventIdStr = json_string_value(event_id_field);
        const char *timestamp = json_string_value(timestamp_field);

        if (!json_is_string(snmpTrapOid_field) || !json_is_string(device_field) || !json_string_value(event_id_field))
        {
            fprintf(stderr, "[WARN] Missing or invalid 'snmpTrapOid' or 'device' or 'evendId'. Skipping...\n");
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        if (timestamp)
        {
            printf("[INFO] Received a signal message from %s with snmpTrapOid %s and timestamp %s\n",
                   device, snmpTrapOid, timestamp);
        }

        json_t *tags = json_object_get(root, "tags");

        if (!json_is_object(tags))
        {
            // fprintf(stderr, "[WARN] 'tags' field missing or invalid. Using empty object.\n");
            tags = json_object();
        }

        printf("[INFO] Processing snmpTrapOid: %s for device: %s\n", snmpTrapOid, device);

        // Check if there is an active signal matching this input
        ActiveSignal *matched_signal = NULL;
        for (int i = 0; i < active_signal_count; i++)
        {
            if (findActiveSignals(&active_signals[i], device, snmpTrapOid, tags))
            {
                matched_signal = &active_signals[i];
                break;
            }
        }

        // Find matching rules
        int rule_match_count = 0;
        RuleMatch *matches = findSignalRule(snmpTrapOid, tags, &rule_match_count);

        if (rule_match_count > 0)
        {
            for (int i = 0; i < rule_match_count; i++)
            {
                StatefulRule *rule = matches[i].rule;
                MatchType type = matches[i].match_type;

                printRule(rule);

                if (type == MATCH_OPEN)
                {
                    if (matched_signal)
                    {
                        printf("[INFO] Signal already exists. No action taken for MATCH_OPEN.\n");
                    }
                    else
                    {
                        printf("[ACTION] Creating new signal from rule ID %d\n", rule->id);
                        createSignal(rule, device, snmpTrapOid, tags, eventIdStr);
                    }
                }
                else if (type == MATCH_CLOSE)
                {
                    if (matched_signal)
                    {
                        printf("[ACTION] Closing existing signal ID %d for rule ID %d\n", matched_signal->id, rule->id);
                        closeSignal(matched_signal);
                    }
                    else
                    {
                        printf("[INFO] No active signal found for MATCH_CLOSE\n");
                    }
                }
            }

            free(matches);
        }
        else
        {
            printf("[INFO] No matching rule found for snmpTrapOid %s\n", snmpTrapOid);
        }

        json_decref(root);
        free(payload);
        rd_kafka_message_destroy(rkmessage);
    }
}
