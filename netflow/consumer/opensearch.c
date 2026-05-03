#include "globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
#include <unistd.h>
#include <curl/curl.h>

#define OPENSEARCH_NODE_COUNT 3 

const char *opensearch_nodes[OPENSEARCH_NODE_COUNT] = {
    "http://opensearch-node1:9200",
    "http://opensearch-node2:9200",
    "http://opensearch-node3:9200"
};

void create_netflow_index() {
    CURL *curl;
    CURLcode res;

    const char *mapping_json =
        "{"
        "    \"settings\": {"
        "      \"number_of_shards\": 1,"
        "      \"number_of_replicas\": 1"
        "    },"
        "    \"mappings\": {"
        "      \"dynamic\": false,"
        "      \"properties\": {"
        "        \"@timestamp\":        {\"type\": \"date\"},"
        "        \"device\":            {\"type\": \"ip\"},"
        "        \"source_ip\":       {\"type\": \"ip\"},"
        "        \"dest_ip\":         {\"type\": \"ip\"},"
        "        \"protocol\":          {\"type\": \"long\"}," // Changed to long to be safe
        "        \"source_port\":       {\"type\": \"long\"}," // Changed to long to be safe
        "        \"dest_port\":         {\"type\": \"long\"}," // Changed to long to be safe
        "        \"input_snmp\":        {\"type\": \"long\"},"
        "        \"output_snmp\":       {\"type\": \"long\"},"
        "        \"bytes_count\":       {\"type\": \"long\"},"
        "        \"packets_count\":     {\"type\": \"long\"},"
        "        \"first_switched\":    {\"type\": \"long\"}," 
        "        \"last_switched\":     {\"type\": \"long\"}"  
        "      }"
        "    }"
        "}";

    int max_retries = 10;
    int retry_delay = 30; // seconds
    int attempt = 0;
    int success = 0;

    curl_global_init(CURL_GLOBAL_DEFAULT);

    while (attempt < max_retries && !success) {
        for (int i = 0; i < OPENSEARCH_NODE_COUNT && !success; i++) {
            curl = curl_easy_init();
            if (curl) {
                struct curl_slist *headers = NULL;
                headers = curl_slist_append(headers, "Content-Type: application/json");

                char index_url[256];
                snprintf(index_url, sizeof(index_url), "%s/netflow", opensearch_nodes[i]);

                curl_easy_setopt(curl, CURLOPT_URL, index_url);
                curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "PUT");
                curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
                curl_easy_setopt(curl, CURLOPT_POSTFIELDS, mapping_json);

                res = curl_easy_perform(curl);

                if (res == CURLE_OK) {
                    fprintf(stdout, "[INFO] OpenSearch index 'netflow' created or already exists on %s.\n", opensearch_nodes[i]);
                    success = 1;
                } else {
                    fprintf(stderr, "[WARN] Attempt %d (node %s): Failed: %s\n",
                            attempt + 1, opensearch_nodes[i], curl_easy_strerror(res));
                }

                curl_easy_cleanup(curl);
                curl_slist_free_all(headers);
            }
        }

        if (!success) {
            attempt++;
            if (attempt < max_retries) {
                sleep(retry_delay);
            }
        }
    }

    curl_global_cleanup();

    if (!success) {
        fprintf(stderr, "[ERROR] Could not connect to any OpenSearch node after %d attempts. Exiting.\n", max_retries);
        exit(1);
    }
}


void send_bulk_to_opensearch(char **json_docs, int doc_count) {
    CURL *curl;
    CURLcode res;

    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();

    if (!curl) {
        fprintf(stderr, "[ERROR] Failed to initialize CURL\n");
        return;
    }

    // Construct the bulk request body
    size_t bulk_len = 0;
    for (int i = 0; i < doc_count; i++) {
        bulk_len += strlen(json_docs[i]) + 100;  // Estimate
    }

    char *bulk_data = malloc(bulk_len + doc_count * 2 + 1);
    if (!bulk_data) {
        fprintf(stderr, "[ERROR] Failed to allocate memory for bulk_data\n");
        curl_easy_cleanup(curl);
        return;
    }

    bulk_data[0] = '\0';
    for (int i = 0; i < doc_count; i++) {
        strcat(bulk_data, "{ \"index\": { \"_index\": \"netflow\" } }\n");
        strcat(bulk_data, json_docs[i]);
        strcat(bulk_data, "\n");
    }

    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/x-ndjson");

    int success = 0;
    for (int i = 0; i < OPENSEARCH_NODE_COUNT && !success; i++) {
        char bulk_url[256];
        snprintf(bulk_url, sizeof(bulk_url), "%s/_bulk", opensearch_nodes[i]);

        curl_easy_setopt(curl, CURLOPT_URL, bulk_url);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, bulk_data);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE, strlen(bulk_data));

        res = curl_easy_perform(curl);

        if (res != CURLE_OK) {
            fprintf(stderr, "[WARN] Bulk send failed on %s: %s\n",
                    opensearch_nodes[i], curl_easy_strerror(res));
        } else {
            printf("[INFO] Bulk data sent to OpenSearch (%d documents) via %s\n",
                   doc_count, opensearch_nodes[i]);
            success = 1;
        }
    }

    if (!success) {
        fprintf(stderr, "[ERROR] Failed to send bulk data to any OpenSearch node.\n");
    }

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);
    free(bulk_data);
}