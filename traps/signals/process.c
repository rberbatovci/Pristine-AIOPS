#include "globals.h"
#include <string.h>
#include <stdio.h>
#include <jansson.h>
#include <librdkafka/rdkafka.h>
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

        printf("[KAFKA MESSAGE] %s\n", payload);

        json_error_t error;
        json_t *root = json_loads(payload, 0, &error);

        if (!root)
        {
            fprintf(stderr, "[ERROR] Failed to parse JSON: %s\n", error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        printf("[INFO] Received a signal message from trap consumer\n");

        json_t *snmpTrapOid_field = json_object_get(root, "snmpTrapOid");
        json_t *content_field = json_object_get(root, "content");
        json_t *device_field = json_object_get(root, "device");
        json_t *event_id_field = json_object_get(root, "eventId");
        const char *snmpTrapOid = json_string_value(snmpTrapOid_field);
        const char *device = json_string_value(device_field);
        const char *eventIdStr = json_string_value(event_id_field);
        

        if (!json_is_string(snmpTrapOid_field) || !json_is_string(device_field))
        {
            fprintf(stderr, "[WARN] Missing or invalid 'snmpTrapOid' or 'device' or 'evendId'. Skipping...\n");
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_t *content = NULL;
        if (json_is_object(content_field))
        {
            content = content_field;
        }
        else
        {
            fprintf(stderr, "[WARN] 'content' field missing or invalid, using empty object.\n");
            content = json_object();
        }

        if (device && snmpTrapOid && content)
        {
            printf("[INFO] Received a signal message from %s with snmpTrapOid %s\n",
                   device, snmpTrapOid);

            char *content_str = json_dumps(content, JSON_INDENT(2));
            if (content_str)
            {
                printf("[INFO] Content:\n%s\n", content_str);
                free(content_str);
            }
        }

        if (!json_is_object(content))
        {
            content = json_object();
        }

        printf("[INFO] Processing snmpTrapOid: %s for device: %s\n", snmpTrapOid, device);

        int rule_match_count = 0;
        RuleMatch *matches = findSignalRule(snmpTrapOid, content, &rule_match_count);

        if (rule_match_count > 0)
        {
            for (int i = 0; i < rule_match_count; i++)
            {
                StatefulRule *rule = matches[i].rule;
                MatchType type = matches[i].match_type;

                printRule(rule);

                if (type == MATCH_OPEN)
                {
                    ActiveSignal *matched_signal = NULL;

                    for (int j = 0; j < active_signal_count; j++)
                    {
                        if (findActiveSignals(&active_signals[j], device, rule->name, content))
                        {
                            matched_signal = &active_signals[j];
                            break;
                        }
                    }

                    if (matched_signal)
                    {
                        printSignal(matched_signal);
                        printf("[INFO] Signal already exists. No action taken for MATCH_OPEN.\n");
                    }
                    else
                    {
                        createSignal(rule, device, snmpTrapOid, content, eventIdStr);
                    }
                }
                else if (type == MATCH_CLOSE)
                {
                    ActiveSignal *matched_signal = NULL;

                    for (int j = 0; j < active_signal_count; j++)
                    {
                        if (findActiveSignals(&active_signals[j], device, rule->name, content))
                        {
                            matched_signal = &active_signals[j];
                            break;
                        }
                    }

                    if (matched_signal)
                    {
                        printf("[ACTION] Closing existing signal ID %s for rule: %s\n", matched_signal->signalId, rule->name);
                        printSignal(matched_signal);
                        closeSignal(matched_signal->signalId, eventIdStr);

                    }
                    else
                    {
                        printf("[INFO] No active signal found for MATCH_CLOSE for rule: %s\n", rule->name);
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
