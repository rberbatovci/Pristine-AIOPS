
#include "globals.h"
#include <curl/curl.h>
#include <string.h>    
#include <unistd.h>   
#include <pthread.h> 

#define BULK_OPENSEARCH_FLUSH_INTERVAL 5
#define MAX_OPENSEARCH_BULK_EVENTS 1

pthread_mutex_t bulk_mutex = PTHREAD_MUTEX_INITIALIZER;

static json_t *bulk_array = NULL;
static int bulk_event_count = 0;
static char *bulk_payload = NULL;

// Initialize bulk array if needed
void init_bulk_array() {
    if (!bulk_array) {
        fprintf(stdout, "[DEBUG] Initializing bulk array\n");
        bulk_array = json_array();
    }
}

void *bulk_flush_thread(void *arg __attribute__((unused)))
{
    while (1)
    {
        sleep(BULK_OPENSEARCH_FLUSH_INTERVAL);

        pthread_mutex_lock(&bulk_mutex);
        if (bulk_event_count > 0 && bulk_payload && strlen(bulk_payload) > 0)
        {
            fprintf(stdout, "[DEBUG] Bulk flush thread sending %d events to OpenSearch\n", bulk_event_count);
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
    else {
        fprintf(stdout, "[INFO] Bulk flush thread created successfully\n");
    }
}


void add_to_bulk_payload(const ActiveSignal *signal) {
    init_bulk_array();

    const char *index = "trap-signals";  // Set index internally

    // Construct OpenSearch bulk action header
    json_t *action_meta = json_pack("{s:{s:s, s:s}}", "index", "_index", index, "_id", signal->signalId);
    json_t *signal_json = json_object();

    json_object_set_new(signal_json, "signalId", json_string(signal->signalId));
    json_object_set_new(signal_json, "device", json_string(signal->device));
    json_object_set_new(signal_json, "rule", json_string(signal->rule));
    json_object_set_new(signal_json, "severity", json_string(signal->severity));
    json_object_set_new(signal_json, "status", json_string(signal->status));
    json_object_set_new(signal_json, "startTime", json_string(signal->startTime));
    json_object_set_new(signal_json, "status_changed_at", json_integer(signal->status_changed_at));
    json_object_set(signal_json, "affectedEntities", signal->affectedEntities);

    // Add endTime if available
    if (strlen(signal->endTime) > 0) {
        json_object_set_new(signal_json, "endTime", json_string(signal->endTime));
    } else {
        json_object_set_new(signal_json, "endTime", json_null());
    }

    // Add snmpTrapOids as a JSON array
    json_t *snmpTrapOids_array = json_array();
    for (int i = 0; i < signal->snmpTrapOids_count; i++) {
        json_array_append_new(snmpTrapOids_array, json_string(signal->snmpTrapOids[i]));
    }
    json_object_set_new(signal_json, "snmpTrapOids", snmpTrapOids_array);

    // Add events as a JSON array
    json_t *events_array = json_array();
    for (int i = 0; i < signal->event_count; i++) {
        json_array_append_new(events_array, json_string(signal->events[i]));
    }
    json_object_set_new(signal_json, "events", events_array);

    // Add both action and document to bulk array
    json_array_append_new(bulk_array, action_meta);
    json_array_append_new(bulk_array, signal_json);

    bulk_event_count++;
    fprintf(stdout, "[DEBUG] Added signal %s to bulk payload. Current bulk event count: %d\n", signal->signalId, bulk_event_count);

    if (bulk_event_count >= MAX_OPENSEARCH_BULK_EVENTS) {
        fprintf(stdout, "[DEBUG] Bulk event count reached max threshold. Sending bulk to OpenSearch.\n");
        send_to_opensearch();
    }
}

void send_bulk_to_opensearch(const char *bulk_payload)
{
    CURL *curl = curl_easy_init();
    if (!curl) {
        fprintf(stderr, "[ERROR] Failed to initialize CURL\n");
        return;
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, "http://OpenSearch:9200/trap-signals/_bulk");
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_payload);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_VERBOSE, 1L); // Enable verbose debug output from libcurl

    CURLcode res = curl_easy_perform(curl);
    if (res != CURLE_OK)
    {
        fprintf(stderr, "[CURL ERROR] %s\n", curl_easy_strerror(res));
    }
    else
    {
        long response_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
        fprintf(stdout, "[INFO] Bulk upload HTTP response code: %ld\n", response_code);
        if (response_code >= 200 && response_code < 300) {
            fprintf(stdout, "[INFO] Bulk upload successful.\n");
        } else {
            fprintf(stderr, "[ERROR] Bulk upload returned HTTP %ld\n", response_code);
        }
    }

    curl_easy_cleanup(curl);
    curl_slist_free_all(headers);
}


void send_to_opensearch(void) {
    if (!bulk_array || json_array_size(bulk_array) == 0) {
        fprintf(stdout, "[DEBUG] No events to send to OpenSearch.\n");
        return;
    }

    pthread_mutex_lock(&bulk_mutex);

    // Reset previous payload if any
    if (bulk_payload) {
        free(bulk_payload);
    }
    bulk_payload = calloc(1, 1);
    size_t bulk_size = 0;

    for (size_t i = 0; i < json_array_size(bulk_array); ++i) {
        json_t *obj = json_array_get(bulk_array, i);
        char *line = json_dumps(obj, JSON_COMPACT);
        if (line) {
            size_t line_len = strlen(line);
            bulk_payload = realloc(bulk_payload, bulk_size + line_len + 2); // +2 for newline and null
            strcat(bulk_payload, line);
            strcat(bulk_payload, "\n");
            bulk_size += line_len + 1;
            free(line);
        }
    }

    fprintf(stdout, "[DEBUG] Prepared bulk payload with %zu lines, size %zu bytes.\n", json_array_size(bulk_array), bulk_size);

    json_decref(bulk_array);
    bulk_array = NULL;

    pthread_mutex_unlock(&bulk_mutex);

    send_bulk_to_opensearch(bulk_payload);
    free(bulk_payload);
    bulk_payload = NULL;
}
