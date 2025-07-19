#include "activeSignals.h"
#include "rules.h"
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <jansson.h>
#include <hiredis/hiredis.h>
#include <curl/curl.h>
#include <pthread.h>
#include <stdlib.h>
#include <unistd.h>

#define MAX_SIGNALS 1000 // Make sure you define a limit

#define MAX_OPENSEARCH_BULK_EVENTS 1000
#define BULK_OPENSEARCH_FLUSH_INTERVAL 1

char *bulk_payload = NULL;
size_t bulk_event_count = 0;
pthread_mutex_t bulk_mutex = PTHREAD_MUTEX_INITIALIZER;

ActiveSignal active_signals[MAX_SIGNALS];
int active_signal_count = 0;

void send_bulk_to_opensearch(const char *bulk_payload)
{
    CURL *curl = curl_easy_init();
    if (!curl)
        return;

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, "http://OpenSearch:9200/syslog-signals/_bulk");
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
    json_object_set_new(root, "id", json_integer(sig->id));
    json_object_set_new(root, "device", json_string(sig->device));
    json_object_set_new(root, "startTime", json_string(sig->startTime));
    json_object_set_new(root, "endTime", json_string(sig->endTime));
    json_object_set_new(root, "status", json_string(sig->status));
    json_object_set_new(root, "severity", json_string(sig->severity));
    json_object_set_new(root, "rule", json_string(sig->rule));

    // Mnemonics array
    json_t *mnemonics_array = json_array();
    for (int i = 0; i < sig->mnemonic_count; i++)
    {
        json_array_append_new(mnemonics_array, json_string(sig->mnemonics[i]));
    }
    json_object_set_new(root, "mnemonics", mnemonics_array);

    // Event IDs array
    json_t *event_ids_array = json_array();
    for (int i = 0; i < sig->event_count; i++)
    {
        json_array_append_new(event_ids_array, json_string((char *)sig->event_ids[i]));
    }
    json_object_set_new(root, "event_ids", event_ids_array);

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

void *bulk_flush_thread(void *arg)
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
    char id_str[64];
    snprintf(id_str, sizeof(id_str), "signal-%d", sig->id);

    char *doc_json = active_signal_to_json(sig);

    if (!doc_json)
    {
        fprintf(stderr, "[ERROR] Failed to serialize active signal to JSON\n");
        return;
    }

    char action_line[256];
    snprintf(action_line, sizeof(action_line),
             "{\"index\":{\"_index\":\"%s\",\"_id\":\"%s\"}}\n", index_name, id_str);

    // ✅ Safe length calculation
    size_t bulk_len = (*bulk) ? strlen(*bulk) : 0;
    size_t action_len = strlen(action_line);
    size_t doc_len = strlen(doc_json);
    size_t new_len = bulk_len + action_len + doc_len + 2 + 1; // +2 for newline, +1 for null terminator

    // ✅ realloc buffer
    char *new_bulk = realloc(*bulk, new_len);
    if (!new_bulk)
    {
        fprintf(stderr, "[ERROR] Failed to realloc bulk payload\n");
        free(doc_json);
        return;
    }

    *bulk = new_bulk;

    // ✅ Append safely using memcpy
    memcpy(*bulk + bulk_len, action_line, action_len);
    memcpy(*bulk + bulk_len + action_len, doc_json, doc_len);
    (*bulk)[bulk_len + action_len + doc_len] = '\n';
    (*bulk)[new_len - 1] = '\0';

    free(doc_json);
}

void close_and_queue_bulk(ActiveSignal *sig, char **bulk, size_t *bulk_size)
{
    char id_str[64];
    snprintf(id_str, sizeof(id_str), "signal-%d", sig->id);

    // Create partial doc for OpenSearch
    json_t *doc = json_object();
    json_object_set_new(doc, "status", json_string("closed"));
    json_object_set_new(doc, "endTime", json_string(sig->endTime));

    json_t *wrap = json_object();
    json_object_set_new(wrap, "doc", doc);

    char *update_json = json_dumps(wrap, JSON_COMPACT);
    json_decref(wrap); // free the JSON object

    char action_line[128];
    snprintf(action_line, sizeof(action_line), "{\"update\":{\"_index\":\"syslog-signals\",\"_id\":\"%s\"}}\n", id_str);

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

int findActiveSignals(ActiveSignal *signal, const char *target_device, const char *target_mnemonic, json_t *target_entities)
{
    if (strcmp(signal->device, target_device) != 0)
    {
        return 0;
    }

    int mnemonic_found = 0;
    for (int i = 0; i < signal->mnemonic_count; i++)
    {
        if (strcmp(signal->mnemonics[i], target_mnemonic) == 0)
        {
            mnemonic_found = 1;
            break;
        }
    }

    if (!mnemonic_found)
    {
        return 0;
    }

    if (!json_subset_match(signal->affectedEntities, target_entities))
    {
        return 0;
    }

    return 1;
}

void createSignal(StatefulRule *rule, const char *device, const char *mnemonic, json_t *tags, const char *eventIdStr)
{
    if (!rule)
    {
        fprintf(stderr, "[ERROR] Rule is NULL\n");
        return;
    }
    fprintf(stdout, "[DEBUG] Creating signal with rule: %s\n", rule ? rule->name : "NULL");

    if (eventIdStr)
    {
        fprintf(stdout, "[DEBUG] eventId: %s\n", eventIdStr);
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
    signal->id = active_signal_count + 1;

    strncpy(signal->device, device, sizeof(signal->device));
    strncpy(signal->rule, rule->name, sizeof(signal->rule));
    strncpy(signal->severity, rule->severity, sizeof(signal->severity));
    strncpy(signal->status, "open", sizeof(signal->status));

    signal->mnemonic_count = 1;
    strncpy(signal->mnemonics[0], mnemonic, sizeof(signal->mnemonics[0]));

    getCurrentTimeStr(signal->startTime, sizeof(signal->startTime));
    strcpy(signal->endTime, ""); // Not closed yet

    if (eventIdStr)
    {
        strncpy(signal->event_ids[0], eventIdStr, sizeof(signal->event_ids[0]));
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
    create_and_queue_bulk(signal, &bulk_payload, "syslog-signals");

    active_signal_count++;

    printSignal(signal);
}

void closeSignal(ActiveSignal *signal)
{
    getCurrentTimeStr(signal->endTime, sizeof(signal->endTime));

    pthread_mutex_lock(&bulk_mutex);
    close_and_queue_bulk(signal, &bulk_payload, &bulk_event_count);
    pthread_mutex_unlock(&bulk_mutex);

    int idx = signal - active_signals;
    delete_signal_from_memory(idx);
}

void printSignal(const ActiveSignal *signal)
{
    if (!signal)
    {
        printf("Signal is NULL.\n");
        return;
    }

    printf("\n[New Signal Created]\n");
    printf("ID: %d\n", signal->id);
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
        printf("%s", signal->event_ids[i]);
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
