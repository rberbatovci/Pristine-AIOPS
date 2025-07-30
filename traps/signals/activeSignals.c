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

char *bulk_payload = NULL;
size_t bulk_event_count = 0;
pthread_mutex_t bulk_mutex = PTHREAD_MUTEX_INITIALIZER;

ActiveSignal active_signals[MAX_SIGNALS];
int active_signal_count = 0;

void create_trap_signals_index() {
    CURL *curl;
    CURLcode res;

    const char *index_url = "http://OpenSearch:9200/trap-signals";
    const char *mapping_json =
        "{"
        "  \"settings\": {"
        "    \"number_of_shards\": 1,"
        "    \"number_of_replicas\": 1"
        "  },"
        "  \"mappings\": {"
        "    \"properties\": {"
        "      \"signalId\": {\"type\": \"keyword\"},"
        "      \"snmpTrapOids\": {\"type\": \"keyword\"},"
        "      \"device\": {\"type\": \"keyword\"},"
        "      \"startTime\": {\"type\": \"date\"},"
        "      \"endTime\": {\"type\": \"date\"},"
        "      \"status\": {\"type\": \"keyword\"},"
        "      \"severity\": {\"type\": \"keyword\"},"
        "      \"events\": {\"type\": \"keyword\"},"
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

        if (res != CURLE_OK)
            fprintf(stderr, "[ERROR] Failed to create index 'trap-signals': %s\n", curl_easy_strerror(res));
        else
            fprintf(stdout, "[INFO] OpenSearch index 'trap-signals' created or already exists.\n");

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
                active_signals[j] = active_signals[i]; // copy to front
            }
            j++;
        } else {
            printf("[CLEANUP] Removing closed signal %s\n", active_signals[i].signalId);

            // Free dynamically allocated memory if any
            for (int k = 0; k < active_signals[i].snmpTrapOids_count; ++k) {
                free(active_signals[i].snmpTrapOids[k]);
            }
            free(active_signals[i].snmpTrapOids);

            for (int k = 0; k < active_signals[i].event_count; ++k) {
                free(active_signals[i].events[k]);
            }
            free(active_signals[i].events);

            json_decref(active_signals[i].affectedEntities);
        }
    }
    active_signal_count = j;
}

void updateSignalStates() {
    time_t now = time(NULL);
    for (int i = 0; i < active_signal_count; i++) {
        ActiveSignal *s = &active_signals[i];
        StatefulRule *rule = findRuleByName(s->rule);
        if (!rule) continue;

        if (strcmp(s->status, "warmUp") == 0 && difftime(now, s->status_changed_at) >= rule->warmup) {
            printf("[STATE] Promoting signal %s from warmUp to open\n", s->signalId);
            strncpy(s->status, "open", sizeof(s->status) - 1);
            s->status_changed_at = now;
            queue_signal_status_update(s, &bulk_payload, "trap-signals");
        } else if (strcmp(s->status, "coolDown") == 0 && difftime(now, s->status_changed_at) >= rule->cooldown) {
            printf("[STATE] Closing signal %s from coolDown to closed\n", s->signalId);
            strncpy(s->status, "closed", sizeof(s->status) - 1);
            s->status_changed_at = now;
            queue_signal_status_update(s, &bulk_payload, "trap-signals");
        }
    }

    // ✅ Send to OpenSearch before removing
    if (bulk_payload && strlen(bulk_payload) > 0) {
        send_bulk_to_opensearch(bulk_payload);  // You need a function for this
        free(bulk_payload);
        bulk_payload = NULL;
    }

    removeClosedSignals();
}

static void *state_monitor_thread() {
    while (1) {
        updateSignalStates();
        sleep(1);
    }
    return NULL;
}

void activeSignalMonitor() {
    pthread_t monitor_thread;
    if (pthread_create(&monitor_thread, NULL, state_monitor_thread, NULL) != 0) {
    } else {
        pthread_detach(monitor_thread);
    }
}

void generate_uuid(char *uuid_str, size_t size)
{
    uuid_t uuid;
    uuid_generate(uuid);
    uuid_unparse(uuid, uuid_str);
    uuid_str[size - 1] = '\0';
}

void send_bulk_to_opensearch(const char *bulk_payload)
{
    CURL *curl = curl_easy_init();
    if (!curl)
        return;

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, "http://OpenSearch:9200/trap-signals/_bulk");
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_payload);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK)
    {
        fprintf(stderr, "[CURL ERROR] %s\n", curl_easy_strerror(res));
    }

    curl_easy_cleanup(curl);
    curl_slist_free_all(headers);
}

char *active_signal_to_json(ActiveSignal *sig)
{
    json_t *root = json_object();

    // Basic fields
    json_object_set_new(root, "signalId", json_string(sig->signalId)); // Use signalId
    json_object_set_new(root, "device", json_string(sig->device));
    json_object_set_new(root, "startTime", json_string(sig->startTime));
    json_object_set_new(root, "endTime", json_string(sig->endTime));
    json_object_set_new(root, "status", json_string(sig->status));
    json_object_set_new(root, "severity", json_string(sig->severity));
    json_object_set_new(root, "rule", json_string(sig->rule));

    // SNMP Trap OIDs
    json_t *snmpTrapOid_array = json_array();
    for (int i = 0; i < sig->snmpTrapOids_count; i++)
    {
        json_array_append_new(snmpTrapOid_array, json_string(sig->snmpTrapOids[i]));
    }
    json_object_set_new(root, "snmpTrapOids", snmpTrapOid_array);

    // Event IDs
    json_t *events_array = json_array();
    for (int i = 0; i < sig->event_count; i++)
    {
        json_array_append_new(events_array, json_string(sig->events[i]));
    }
    json_object_set_new(root, "events", events_array);

    // Affected entities
    if (sig->affectedEntities)
    {
        json_object_set(root, "affectedEntities", sig->affectedEntities); // borrowed reference
    }
    else
    {
        json_object_set_new(root, "affectedEntities", json_object());
    }

    char *json_str = json_dumps(root, JSON_COMPACT);
    json_decref(root);
    return json_str;
}

void *bulk_flush_thread()
{
    while (1)
    {
        sleep(BULK_OPENSEARCH_FLUSH_INTERVAL);

        pthread_mutex_lock(&bulk_mutex);
        if (bulk_event_count >= MAX_OPENSEARCH_BULK_EVENTS || (bulk_payload && strlen(bulk_payload) > 0))
        {
            printf("[INFO] Sending bulk with %zu events to OpenSearch\n", bulk_event_count);
            send_bulk_to_opensearch(bulk_payload);
            free(bulk_payload);
            bulk_payload = calloc(1, 1);
            bulk_event_count = 0;
        }
        pthread_mutex_unlock(&bulk_mutex);
    }
    return NULL;
}

void flushOpensearchBulkData()
{
    pthread_t thread;
    if (pthread_create(&thread, NULL, bulk_flush_thread, NULL) != 0)
    {
        fprintf(stderr, "[ERROR] Failed to create bulk flush thread\n");
    }
    else
    {
        printf("[INFO] Bulk flush thread started\n");
    }
}

void create_and_queue_bulk(ActiveSignal *sig, char **bulk, const char *index_name)
{
    if (sig->signalId[0] == '\0')
    {
        fprintf(stderr, "[ERROR] signalId is empty, cannot create OpenSearch document\n");
        return;
    }

    char *doc_json = active_signal_to_json(sig);
    if (!doc_json)
    {
        fprintf(stderr, "[ERROR] Failed to serialize active signal to JSON\n");
        return;
    }

    char action_line[256];
    snprintf(action_line, sizeof(action_line),
             "{\"index\":{\"_index\":\"%s\",\"_id\":\"%s\"}}\n", index_name, sig->signalId);

    // Safe length calculation
    size_t bulk_len = (*bulk) ? strlen(*bulk) : 0;
    size_t action_len = strlen(action_line);
    size_t doc_len = strlen(doc_json);
    size_t new_len = bulk_len + action_len + doc_len + 2 + 1; // newline + null terminator

    char *new_bulk = realloc(*bulk, new_len);
    if (!new_bulk)
    {
        fprintf(stderr, "[ERROR] Failed to realloc bulk payload\n");
        free(doc_json);
        return;
    }

    *bulk = new_bulk;

    memcpy(*bulk + bulk_len, action_line, action_len);
    memcpy(*bulk + bulk_len + action_len, doc_json, doc_len);
    (*bulk)[bulk_len + action_len + doc_len] = '\n';
    (*bulk)[new_len - 1] = '\0';

    free(doc_json);
}

void close_and_queue_bulk(ActiveSignal *sig, char **bulk, size_t *bulk_size)
{
    if (sig->signalId[0] == '\0')
    {
        fprintf(stderr, "[ERROR] Cannot close signal with empty signalId\n");
        return;
    }

    // Create partial doc for OpenSearch
    json_t *doc = json_object();
    json_object_set_new(doc, "status", json_string("closed"));
    json_object_set_new(doc, "endTime", json_string(sig->endTime));

    json_t *wrap = json_object();
    json_object_set_new(wrap, "doc", doc);

    char *update_json = json_dumps(wrap, JSON_COMPACT);
    json_decref(wrap); // free the JSON object

    char action_line[128];
    snprintf(action_line, sizeof(action_line), "{\"update\":{\"_index\":\"trap-signals\",\"_id\":\"%s\"}}\n", sig->signalId);

    // Calculate total new size
    size_t new_data_len = strlen(action_line) + strlen(update_json) + 2; // \n after doc
    *bulk = realloc(*bulk, *bulk_size + new_data_len + 1);               // +1 for null terminator
    if (*bulk == NULL)
    {
        fprintf(stderr, "[ERROR] Failed to realloc bulk buffer\n");
        free(update_json);
        return;
    }

    // Append to bulk buffer
    strcat(*bulk, action_line);
    strcat(*bulk, update_json);
    strcat(*bulk, "\n");

    *bulk_size += new_data_len;

    free(update_json);
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

void getCurrentTimeStr(char *buffer, size_t len)
{
    time_t now = time(NULL);
    struct tm *tm_info = localtime(&now);
    strftime(buffer, len, "%Y-%m-%d %H:%M:%S", tm_info);
}

int json_subset_match(json_t *subset, json_t *target) {
    if (!json_is_object(subset) || !json_is_object(target)) {
        return 0;
    }

    const char *key;
    json_t *value;

    json_object_foreach(subset, key, value) {
        json_t *target_value = json_object_get(target, key);
        if (!target_value) {
            return 0;  // key not found
        }

        // Compare JSON values
        if (!json_equal(value, target_value)) {
            return 0;  // value mismatch
        }
    }

    return 1;
}

int findActiveSignals(ActiveSignal *signal, const char *target_device, const char *target_rule_name, json_t *target_entities)
{
    if (strcmp(signal->device, target_device) != 0) {
        printf("[DEBUG] Device mismatch: signal=%s, target=%s\n", signal->device, target_device);
        return 0;
    }

    if (strcmp(signal->rule, target_rule_name) != 0) {
        printf("[DEBUG] Rule mismatch: signal=%s, target=%s\n", signal->rule, target_rule_name);
        return 0;
    }

    if (!json_subset_match(signal->affectedEntities, target_entities)) {
        printf("[DEBUG] Affected entities mismatch\n");

        char *expected_str = json_dumps(signal->affectedEntities, JSON_INDENT(2));
        char *actual_str = json_dumps(target_entities, JSON_INDENT(2));
        if (expected_str && actual_str) {
            printf("[DEBUG] Signal Entities:\n%s\n", expected_str);
            printf("[DEBUG] Incoming Content:\n%s\n", actual_str);
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
    printf("ID: %s\n", signal->signalId);
    printf("Device: %s\n", signal->device);
    printf("Rule: %s\n", signal->rule);
    printf("Severity: %s\n", signal->severity);
    printf("Status: %s\n", signal->status);
    printf("Start Time: %s\n", signal->startTime);
    printf("End Time: %s\n", signal->endTime[0] ? signal->endTime : "(still open)");

    printf("SnmpTrapOids: ");
    for (int i = 0; i < signal->snmpTrapOids_count; ++i)
    {
        printf("%s", signal->snmpTrapOids[i]);
        if (i < signal->snmpTrapOids_count - 1)
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

void createSignal(StatefulRule *rule, const char *device, const char *snmpTrapOid, json_t *content, const char *eventIdStr)
{
    if (!rule)
    {
        fprintf(stderr, "[ERROR] Rule is NULL\n");
        return;
    }
    fprintf(stdout, "[DEBUG] Creating signal with rule: %s\n", rule ? rule->name : "NULL");

    if (!eventIdStr)
    {
        fprintf(stdout, "[DEBUG] eventId: NULL\n");
    }
    else
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

    signal->snmpTrapOids_count = 1;
    strncpy(signal->snmpTrapOids[0], snmpTrapOid, sizeof(signal->snmpTrapOids[0]));
    signal->snmpTrapOids[0][sizeof(signal->snmpTrapOids[0]) - 1] = '\0';

    getCurrentTimeStr(signal->startTime, sizeof(signal->startTime));
    strcpy(signal->endTime, ""); // Not closed yet

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

            json_t *value = json_object_get(content, key);
            if (value)
            {
                json_object_set(signal->affectedEntities, key, value);
            }
        }

        json_decref(affected_keys);
    }

    // ✅ Add to OpenSearch bulk payload
    if (bulk_payload == NULL)
    {
        bulk_payload = malloc(1024);
        bulk_payload[0] = '\0';
    }
    create_and_queue_bulk(signal, &bulk_payload, "trap-signals");

    active_signal_count++;

    printSignal(signal);
}

void closeSignal(const char *signalId, const char *eventId)
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
            getCurrentTimeStr(signal->endTime, sizeof(signal->endTime));

            // Set status to closed and update timestamp
            strncpy(signal->status, "coolDown", sizeof(signal->status) - 1);
            signal->status[sizeof(signal->status) - 1] = '\0';
            signal->status_changed_at = time(NULL);

            // Lock + queue update OpenSearch partial doc
            pthread_mutex_lock(&bulk_mutex);
            queue_signal_status_update(signal, &bulk_payload, "trap-signals");
            pthread_mutex_unlock(&bulk_mutex);

            // Do NOT delete from memory — keep the signal active
            return;
        }
    }

    fprintf(stderr, "[WARNING] Signal with signalId '%s' not found to close\n", signalId);
}

void queue_signal_status_update(ActiveSignal *sig, char **bulk, const char *index_name) {
    char update_action[256];
    snprintf(update_action, sizeof(update_action),
             "{\"update\":{\"_index\":\"%s\",\"_id\":\"%s\"}}\n", index_name, sig->signalId);

    // Build JSON array for events
    char events_json[4096] = "[";
    for (int i = 0; i < sig->event_count; i++) {
        char event_str[80];
        snprintf(event_str, sizeof(event_str), "\"%s\"", sig->events[i]);
        strcat(events_json, event_str);
        if (i != sig->event_count - 1) {
            strcat(events_json, ",");
        }
    }
    strcat(events_json, "]");

    // Build the partial doc with status, timestamp and events
    char update_doc[8192];
    snprintf(update_doc, sizeof(update_doc),
             "{\"doc\":{\"status\":\"%s\",\"status_changed_at\":%ld,\"events\":%s}}\n",
             sig->status, sig->status_changed_at, events_json);

    size_t bulk_len = (*bulk) ? strlen(*bulk) : 0;
    size_t action_len = strlen(update_action);
    size_t doc_len = strlen(update_doc);
    size_t new_len = bulk_len + action_len + doc_len + 1;

    char *new_bulk = realloc(*bulk, new_len);
    if (!new_bulk) {
        fprintf(stderr, "[ERROR] Failed to realloc bulk payload for update\n");
        return;
    }

    *bulk = new_bulk;

    memcpy(*bulk + bulk_len, update_action, action_len);
    memcpy(*bulk + bulk_len + action_len, update_doc, doc_len);
    (*bulk)[new_len - 1] = '\0';
}