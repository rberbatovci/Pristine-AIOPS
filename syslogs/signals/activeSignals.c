#include "globals.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <jansson.h>
#include <hiredis/hiredis.h>
#include <curl/curl.h>
#include <pthread.h>
#include <stdlib.h>
#include <unistd.h>
#include <uuid/uuid.h>

#define MAX_SIGNALS 1000 // Make sure you define a limit

#define MAX_OPENSEARCH_BULK_EVENTS 1000
#define BULK_OPENSEARCH_FLUSH_INTERVAL 1

char endTime[64];

pthread_mutex_t status_update_mutex = PTHREAD_MUTEX_INITIALIZER;

ActiveSignal active_signals[MAX_EVENTS_PER_SIGNAL];
int active_signal_count = 0;

void create_syslog_signals_index() {
    CURL *curl;
    CURLcode res;

    const char *index_url = "http://opensearch:9200/syslog-signals";
    const char *mapping_json =
        "{"
        "  \"settings\": {"
        "    \"number_of_shards\": 1,"
        "    \"number_of_replicas\": 1"
        "  },"
        "  \"mappings\": {"
        "    \"properties\": {"
        "      \"signalId\": {\"type\": \"keyword\"},"
        "      \"mnemonics\": {\"type\": \"keyword\"},"
        "      \"mnemonic_count\": {\"type\": \"integer\"},"
        "      \"flaps\": {\"type\": \"integer\"},"
        "      \"device\": {\"type\": \"keyword\"},"
        "      \"startTime\": {\"type\": \"date\"},"
        "      \"endTime\": {\"type\": \"date\"},"
        "      \"status\": {\"type\": \"keyword\"},"
        "      \"severity\": {\"type\": \"keyword\"},"
        "      \"events\": {\"type\": \"keyword\"},"
        "      \"event_count\": {\"type\": \"integer\"},"
        "      \"status_changed_at\": {\"type\": \"date\"},"
        "      \"affectedEntities\": {\"type\": \"object\"},"
        "      \"rule\": {\"type\": \"keyword\"}"
        "    }"
        "  }"
        "}";

    curl_global_init(CURL_GLOBAL_DEFAULT);
    curl = curl_easy_init();

    if (curl) {
        struct curl_slist *headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");

        curl_easy_setopt(curl, CURLOPT_URL, index_url);
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, mapping_json);

        res = curl_easy_perform(curl);

        if (res != CURLE_OK) {
            fprintf(stderr, "[ERROR] Failed to create 'syslog-signals' index: %s\n", curl_easy_strerror(res));
        } else {
            fprintf(stdout, "[INFO] OpenSearch index 'syslog-signals' created or already exists.\n");
        }

        curl_easy_cleanup(curl);
        curl_slist_free_all(headers);
    }

    curl_global_cleanup();
}

void removeClosedSignals() {
    int j = 0;
    for (int i = 0; i < active_signal_count; i++) {
        if (strcmp(active_signals[i].status, "closed") != 0) {
            if (i != j) {
                active_signals[j] = active_signals[i];
            }
            j++;
        } else {
            printf("[CLEANUP] Removing closed signal %s\n", active_signals[i].signalId);

            // DO NOT free fixed arrays like mnemonics or events

            // Clean up only dynamically allocated fields
            if (active_signals[i].affectedEntities) {
                json_decref(active_signals[i].affectedEntities);
                active_signals[i].affectedEntities = NULL;
            }

            // Optionally zero out the struct (not required, but helps avoid bugs)
            memset(&active_signals[i], 0, sizeof(ActiveSignal));
        }
    }
    active_signal_count = j;
}

void open_signal(ActiveSignal *s) {
    time_t now = time(NULL);
    strncpy(s->status, "open", sizeof(s->status) - 1);
    s->status_changed_at = now;

    printf("[STATE] Opening signal %s\n", s->signalId);

    store_signal_in_redis(redis_ctx, s);
    add_to_bulk_payload(s);
}

void close_signal(int signal_index) {
    ActiveSignal *s = &active_signals[signal_index];

    printf("[STATE] Closing signal %s\n", s->signalId);

    time_t now = time(NULL);
    strncpy(s->status, "closed", sizeof(s->status) - 1);
    s->status_changed_at = now;

    add_to_bulk_payload(s);
    delete_signal_from_redis(s->signalId);

    if (s->affectedEntities) {
        json_decref(s->affectedEntities);
        s->affectedEntities = NULL;
    }

    for (int j = signal_index; j < active_signal_count - 1; j++) {
        active_signals[j] = active_signals[j + 1];
    }
    active_signal_count--;
}

void updateSignalStates() {
    time_t now = time(NULL);
    for (int i = 0; i < active_signal_count; i++) {
        ActiveSignal *s = &active_signals[i];
        StatefulRule *rule = findRuleByName(s->rule);
        if (!rule) continue;

        if (strcmp(s->status, "warmUp") == 0 && difftime(now, s->status_changed_at) >= rule->warmup) {
            open_signal(s);
        } else if (strcmp(s->status, "coolDown") == 0 && difftime(now, s->status_changed_at) >= rule->cooldown) {
            close_signal(i);
            i--; 
            continue;
        }
    }
    removeClosedSignals();
}

static void *state_monitor_thread() {
    while (1) {
        updateSignalStates();  // your promotion logic
        sleep(1);  // check every second
    }
    return NULL;
}

void activeSignalMonitor() {
    pthread_t monitor_thread;
    if (pthread_create(&monitor_thread, NULL, state_monitor_thread, NULL) != 0) {
        fprintf(stderr, "[ERROR] Failed to start signal monitor thread\n");
    } else {
        pthread_detach(monitor_thread);  // optional: no need to join later
        printf("[INFO] Signal monitor thread started\n");
    }
}

char *active_signal_to_json(ActiveSignal *sig)
{
    json_t *root = json_object();

    // Basic fields
    json_object_set_new(root, "signalId", json_string(sig->signalId));
    json_object_set_new(root, "device", json_string(sig->device));
    json_object_set_new(root, "startTime", json_string(sig->startTime));
    json_object_set_new(root, "status", json_string(sig->status));
    json_object_set_new(root, "severity", json_string(sig->severity));
    json_object_set_new(root, "rule", json_string(sig->rule));

    if (strlen(sig->endTime) > 0) {
        json_object_set_new(root, "endTime", json_string(sig->endTime));
    } else {
        json_object_set_new(root, "endTime", json_null());
    }

    // Mnemonics array
    json_t *mnemonics_array = json_array();
    for (int i = 0; i < sig->mnemonic_count; i++)
    {
        json_array_append_new(mnemonics_array, json_string(sig->mnemonics[i]));
    }
    json_object_set_new(root, "mnemonics", mnemonics_array);

    // Event IDs array
    json_t *events_array = json_array();
    for (int i = 0; i < sig->event_count; i++)
    {
        json_array_append_new(events_array, json_string((char *)sig->events[i]));
    }
    json_object_set_new(root, "events", events_array);

    // Affected entities (already json_t object)
    if (sig->affectedEntities)
    {
        json_object_set(root, "affectedEntities", sig->affectedEntities); // borrowed reference
    }
    else
    {
        json_object_set_new(root, "affectedEntities", json_object());
    }

    // Convert to string
    char *json_str = json_dumps(root, JSON_COMPACT);
    json_decref(root);

    return json_str; // Caller must free
}

void delete_signal_from_memory(int index)
{
    if (index < 0 || index >= active_signal_count)
        return;

    json_decref(active_signals[index].affectedEntities);

    for (int i = index; i < active_signal_count - 1; i++)
    {
        active_signals[i] = active_signals[i + 1];
    }

    memset(&active_signals[active_signal_count - 1], 0, sizeof(ActiveSignal));
    active_signal_count--;
}

void getCurrentTimeStr(char *buffer, size_t size)
{
    time_t now = time(NULL);
    struct tm *tm_info = gmtime(&now);  // Use gmtime for UTC (add 'Z')
    strftime(buffer, size, "%Y-%m-%dT%H:%M:%SZ", tm_info);
}

int json_subset_match(json_t *subset, json_t *fullset)
{
    const char *key;
    json_t *value;

    json_object_foreach(subset, key, value)
    {
        json_t *target_value = json_object_get(fullset, key);
        if (!target_value || !json_equal(value, target_value))
        {
            return 0; // key missing or value mismatch
        }
    }

    return 1;
}

int findActiveSignals(ActiveSignal *signal, const char *target_device, const char *target_rule_name, json_t *target_entities)
{
    if (strcmp(signal->device, target_device) != 0) {
        //printf("[DEBUG] Device mismatch: signal=%s, target=%s\n", signal->device, target_device);
        return 0;
    }

    if (strcmp(signal->rule, target_rule_name) != 0) {
        //printf("[DEBUG] Rule mismatch: signal=%s, target=%s\n", signal->rule, target_rule_name);
        return 0;
    }

    if (!json_subset_match(signal->affectedEntities, target_entities)) {
        //printf("[DEBUG] Affected entities mismatch\n");

        char *expected_str = json_dumps(signal->affectedEntities, JSON_INDENT(2));
        char *actual_str = json_dumps(target_entities, JSON_INDENT(2));
        if (expected_str && actual_str) {
            //printf("[DEBUG] Signal Entities:\n%s\n", expected_str);
            //printf("[DEBUG] Incoming Content:\n%s\n", actual_str);
        }
        free(expected_str);
        free(actual_str);
        return 0;
    }

    return 1;
}

void printSignal(const ActiveSignal *signal)
{
    if (!signal)
    {
        printf("Signal is NULL.\n");
        return;
    }

    printf("\n[New Signal Created]\n");
    printf("Signal ID: %s\n", signal->signalId);
    printf("Device: %s\n", signal->device);
    printf("Rule: %s\n", signal->rule);
    printf("Severity: %s\n", signal->severity);
    printf("Status: %s\n", signal->status);
    printf("Start Time: %s\n", signal->startTime);
    printf("End Time: %s\n", signal->endTime[0] ? signal->endTime : "(still open)");

    printf("Mnemonics: ");
    for (int i = 0; i < signal->mnemonic_count; ++i)
    {
        printf("%s", signal->mnemonics[i]);
        if (i < signal->mnemonic_count - 1)
            printf(", ");
    }
    printf("\n");

    printf("Event IDs: ");
    for (int i = 0; i < signal->event_count; ++i)
    {
        printf("%s", signal->events[i]);
        if (i < signal->event_count - 1)
            printf(", ");
    }
    printf("\n");

    printf("Affected Entities:\n");
    const char *key;
    json_t *value;
    json_object_foreach(signal->affectedEntities, key, value)
    {
        printf("  %s: %s\n", key, json_string_value(value));
    }
    printf("\n");
}

void createSignal(StatefulRule *rule, const char *device, const char *mnemonic, json_t *tags, const char *eventIdStr, const char *timestamp)
{
    if (!rule)
    {
        fprintf(stderr, "[ERROR] Rule is NULL\n");
        return;
    }
    
    //fprintf(stdout, "[DEBUG] Creating signal with rule: %s\n", rule ? rule->name : "NULL");

    if (!eventIdStr)
    {
        fprintf(stdout, "[DEBUG] eventId: NULL\n");
    }

    if (active_signal_count >= MAX_SIGNALS)
    {
        fprintf(stderr, "[ERROR] Max active signals reached!\n");
        return;
    }

    ActiveSignal *signal = &active_signals[active_signal_count];

    uuid_t b_uuid;
    uuid_generate_time(b_uuid); 
    uuid_unparse_lower(b_uuid, signal->signalId);

    strncpy(signal->device, device, sizeof(signal->device) - 1);
    signal->device[sizeof(signal->device) - 1] = '\0'; 

    strncpy(signal->rule, rule->name, sizeof(signal->rule) - 1);
    signal->rule[sizeof(signal->rule) - 1] = '\0';

    strncpy(signal->severity, rule->severity, sizeof(signal->severity) - 1);
    signal->severity[sizeof(signal->severity) - 1] = '\0';

    strncpy(signal->status, "warmUp", sizeof(signal->status) - 1);
    signal->status[sizeof(signal->status) - 1] = '\0';

    signal->status_changed_at = time(NULL);

    signal->mnemonic_count = 1;
    strncpy(signal->mnemonics[0], mnemonic, sizeof(signal->mnemonics[0]) - 1);
    signal->mnemonics[0][sizeof(signal->mnemonics[0]) - 1] = '\0';

    if (timestamp && strlen(timestamp) > 0) {
        strncpy(signal->startTime, timestamp, sizeof(signal->startTime) - 1);
        signal->startTime[sizeof(signal->startTime) - 1] = '\0';
    } else {
        getCurrentTimeStr(signal->startTime, sizeof(signal->startTime));
    }

    signal->endTime[0] = '\0';

    if (eventIdStr)
    {
        strncpy(signal->events[0], eventIdStr, sizeof(signal->events[0]) - 1);
        signal->events[0][sizeof(signal->events[0]) - 1] = '\0';
        signal->event_count = 1;
    }
    else
    {
        signal->event_count = 0;
    }

    json_error_t error;
    json_t *affected_keys = json_loads(rule->affectedEntityJson, 0, &error);
    if (!affected_keys || !json_is_array(affected_keys))
    {
        fprintf(stderr, "[ERROR] Failed to parse affectedEntity JSON: %s\n", error.text);
        signal->affectedEntities = json_object(); // default empty
    }
    else
    {
        signal->affectedEntities = json_object();

        size_t index;
        json_t *key_item;

        json_array_foreach(affected_keys, index, key_item)
        {
            const char *key = json_string_value(key_item);
            if (!key)
                continue;

            json_t *value = json_object_get(tags, key);
            if (value)
            {
                // Increment reference count as json_object_set steals reference
                json_incref(value);
                json_object_set(signal->affectedEntities, key, value);
            }
        }

        json_decref(affected_keys);
    }

    add_to_bulk_payload(signal);
    active_signal_count++;
    store_signal_in_redis(redis_ctx, signal);
    //printSignal(signal);
}

void reopenSignal(ActiveSignal *signal, const char *eventIdStr, const char *timestamp)
{
    if (!signal)
    {
        fprintf(stderr, "[ERROR] Signal is NULL, cannot reopen\n");
        return;
    }

    // Only allow reopening from coolDown
    if (strcmp(signal->status, "coolDown") != 0)
    {
        fprintf(stderr, "[WARN] Signal is not in 'coolDown' state. Current state: %s\n", signal->status);
        return;
    }

    // Change status to 'open' or 'warmUp'
    strncpy(signal->status, "open", sizeof(signal->status) - 1);
    signal->status[sizeof(signal->status) - 1] = '\0';
    signal->status_changed_at = time(NULL);

    // Clear endTime
    signal->endTime[0] = '\0';

    // Append new eventId if provided and there's space
    if (eventIdStr && signal->event_count < MAX_EVENTS_PER_SIGNAL)
    {
        strncpy(signal->events[signal->event_count], eventIdStr, sizeof(signal->events[signal->event_count]) - 1);
        signal->events[signal->event_count][sizeof(signal->events[signal->event_count]) - 1] = '\0';
        signal->event_count++;
    }

    // Optionally update startTime if timestamp is provided
    if (timestamp && strlen(timestamp) > 0)
    {
        strncpy(signal->startTime, timestamp, sizeof(signal->startTime) - 1);
        signal->startTime[sizeof(signal->startTime) - 1] = '\0';
    }

    add_to_bulk_payload(signal);

    printf("[INFO] Reopened signal ID %s for rule %s\n", signal->signalId, signal->rule);
}

void closeSignal(const char *signalId, const char *eventId, const char *timestamp)
{
    for (int i = 0; i < active_signal_count; ++i)
    {
        ActiveSignal *signal = &active_signals[i];
        if (strcmp(signal->signalId, signalId) == 0)
        {
            // Add new eventId if space allows
            if (eventId && signal->event_count < 100)
            {
                strncpy(signal->events[signal->event_count], eventId, sizeof(signal->events[0]) - 1);
                signal->events[signal->event_count][sizeof(signal->events[0]) - 1] = '\0';
                signal->event_count++;
            }

            // Set endTime
            if (timestamp && strlen(timestamp) > 0) {
                strncpy(signal->endTime, timestamp, sizeof(signal->endTime) - 1);
                signal->endTime[sizeof(signal->endTime) - 1] = '\0';
            } else {
                getCurrentTimeStr(signal->endTime, sizeof(signal->endTime));
            }

            // Set status to closed and update timestamp
            strncpy(signal->status, "coolDown", sizeof(signal->status) - 1);
            signal->status[sizeof(signal->status) - 1] = '\0';
            signal->status_changed_at = time(NULL);

            add_to_bulk_payload(signal);

            return;
        }
    }

}
