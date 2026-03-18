#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <librdkafka/rdkafka.h>
#include <curl/curl.h>
#include <jansson.h>
#include <signal.h>
#include <unistd.h>
#include <stdbool.h>  // for bool, true, false
#include <ctype.h>    // for isdigit()

#define TOPIC_NAME "netflow-events"
#define OPENSEARCH_NODE_COUNT 3

const char *opensearch_nodes[OPENSEARCH_NODE_COUNT] = {
    "http://opensearch-node1:9200",
    "http://opensearch-node2:9200",
    "http://opensearch-node3:9200"
};



volatile sig_atomic_t keep_running = 1;

void handle_sigterm(int sig) {
    keep_running = 0;
}

struct response_string {
    char *ptr;
    size_t len;
};

void init_string(struct response_string *s) {
    s->len = 0;
    s->ptr = malloc(1);
    if (s->ptr == NULL) {
        fprintf(stderr, "malloc() failed\n");
        exit(EXIT_FAILURE);
    }
    s->ptr[0] = '\0';
}

size_t writefunc(void *ptr, size_t size, size_t nmemb, struct response_string *s) {
    size_t new_len = s->len + size * nmemb;
    s->ptr = realloc(s->ptr, new_len + 1);
    if (s->ptr == NULL) {
        fprintf(stderr, "realloc() failed\n");
        exit(EXIT_FAILURE);
    }
    memcpy(s->ptr + s->len, ptr, size * nmemb);
    s->ptr[new_len] = '\0';
    s->len = new_len;
    return size * nmemb;
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


char* timestamp_to_iso(json_t *ts_item) {
    if (ts_item && json_is_integer(ts_item)) {
        json_int_t ts_ns = json_integer_value(ts_item);
        // Convert nanoseconds to seconds (approximately, assuming a Unix-like epoch base)
        time_t ts_sec = ts_ns / 1000000000;
        struct tm gmt;
        gmtime_r(&ts_sec, &gmt);
        char *iso_time = malloc(30);
        if (iso_time) {
            strftime(iso_time, 30, "%Y-%m-%dT%H:%M:%S.000000000Z", &gmt);
            return iso_time;
        }
    }
    char *default_iso = strdup("1970-01-01T00:00:00.000000000Z");
    return default_iso;
}

// Safely preprocess large integers in JSON
char *preprocess_large_integers(const char *input, size_t len) {
    char *output = malloc(len * 2);
    if (!output) return NULL;

    size_t i = 0, j = 0;
    bool in_string = false;

    while (i < len) {
        char c = input[i];

        if (c == '"') {
            output[j++] = c;
            i++;
            in_string = !in_string;
            continue;
        }

        if (!in_string && isdigit(c)) {
            size_t start = i;
            while (i < len && isdigit(input[i])) i++;

            size_t num_len = i - start;
            if (num_len >= 19) {
                output[j++] = '"';
                memcpy(&output[j], &input[start], num_len);
                j += num_len;
                output[j++] = '"';
            } else {
                memcpy(&output[j], &input[start], num_len);
                j += num_len;
            }
        } else {
            output[j++] = input[i++];
        }
    }

    output[j] = '\0';
    return output;
}



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

void print_banner() {
    printf("╔══════════════════════════════════════════════╗\n");
    printf("║           Welcome to Pristine-AIOPS          ║\n");
    printf("║                   v1.1 beta                  ║\n");
    printf("║           Thanks for using our tool          ║\n");
    printf("╚══════════════════════════════════════════════╝\n");
    printf("\n");
}

void set_current_timestamp(json_t *root) {
    time_t now = time(NULL);
    struct tm gmt;
    gmtime_r(&now, &gmt);
    char iso_time[30];
    // Use a standard millisecond-precision ISO format for OpenSearch date type
    strftime(iso_time, sizeof(iso_time), "%Y-%m-%dT%H:%M:%S.000Z", &gmt); 

    // Overwrite or create the @timestamp field
    json_object_set_new(root, "@timestamp", json_string(iso_time));
}

char *trim_json_payload(const char *raw_payload, size_t len) {
    if (!raw_payload || len == 0)
        return NULL;

    // Allocate copy
    char *trimmed = malloc(len + 1);
    if (!trimmed)
        return NULL;

    memcpy(trimmed, raw_payload, len);
    trimmed[len] = '\0';

    int brace_count = 0;
    int last_closing_brace = -1;
    bool in_string = false;

    for (size_t i = 0; i < len; i++) {
        char c = trimmed[i];

        if (c == '"' && (i == 0 || trimmed[i - 1] != '\\')) {
            in_string = !in_string;
        } else if (!in_string) {
            if (c == '{') {
                brace_count++;
            } else if (c == '}') {
                brace_count--;
                if (brace_count == 0) {
                    last_closing_brace = i;
                    break;
                }
            }
        }
    }

    if (last_closing_brace != -1) {
        // Keep only up to the closing brace
        trimmed[last_closing_brace + 1] = '\0';

        // Remove any trailing whitespace after }
        for (int j = last_closing_brace + 1; j < (int)len; j++) {
            if (trimmed[j] != '\0')
                trimmed[j] = '\0';
        }
    } else {
        // If malformed, keep as-is for debugging
        fprintf(stderr, "[WARN] No valid JSON object found in payload.\n");
    }

    return trimmed;
}

int main() {
    signal(SIGINT, handle_sigterm);
    signal(SIGTERM, handle_sigterm);

    print_banner();

    printf("🚀 Consumer listening for Netflow data...\n");

    create_netflow_index();

    int BULK_SIZE = 1000;        // default
    int FLUSH_INTERVAL = 1;     // default seconds

    char errstr[512];
    rd_kafka_conf_t *conf = rd_kafka_conf_new();

    if (rd_kafka_conf_set(conf, "bootstrap.servers", "kafka:9092", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "❌ Error setting Kafka config: %s\n", errstr);
        return 1;
    }

    if (rd_kafka_conf_set(conf, "group.id", "netflow-consumer-group", errstr, sizeof(errstr)) != RD_KAFKA_CONF_OK) {
        fprintf(stderr, "❌ Error setting group.id: %s\n", errstr);
        return 1;
    }

    rd_kafka_t *rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "❌ Failed to create Kafka consumer: %s\n", errstr);
        return 1;
    }

    rd_kafka_poll_set_consumer(rk);
    rd_kafka_topic_partition_list_t *topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, TOPIC_NAME, -1);

    if (rd_kafka_subscribe(rk, topics)) {
        fprintf(stderr, "❌ Failed to subscribe to topic: %s\n", rd_kafka_err2str(rd_kafka_last_error()));
        return 1;
    }

    printf("📡 Listening for messages on Kafka topic: %s\n", TOPIC_NAME);

    // buffer for bulk sending
    char **json_buffer = malloc(BULK_SIZE * sizeof(char *));
    int buffer_count = 0;
    time_t last_flush = time(NULL);

    while (keep_running) {
        rd_kafka_message_t *rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage) {
            // check flush interval
            if (buffer_count > 0 && difftime(time(NULL), last_flush) >= FLUSH_INTERVAL) {
                send_bulk_to_opensearch(json_buffer, buffer_count);

                // free memory of docs
                for (int i = 0; i < buffer_count; i++) free(json_buffer[i]);
                buffer_count = 0;
                last_flush = time(NULL);
            }
            continue;
        }

        if (rkmessage->err) {
            fprintf(stderr, "⚠️ Kafka error: %s\n", rd_kafka_message_errstr(rkmessage));
        } else {
            printf("📥 Received raw message (len %zu): %.*s\n", rkmessage->len, (int)rkmessage->len, (char *)rkmessage->payload);

            char *trimmed_payload = trim_json_payload((char *)rkmessage->payload, rkmessage->len);

            if (!trimmed_payload) {
                fprintf(stderr, "❌ Dropping message: Invalid or incomplete JSON payload (len %zu).\n", rkmessage->len);
                rd_kafka_message_destroy(rkmessage);
                continue;
            }

            // 2. Preprocess large integers on the *trimmed* payload
            char *preprocessed = preprocess_large_integers(trimmed_payload, strlen(trimmed_payload));
            free(trimmed_payload); // Free the trimmed copy

            if (!preprocessed) {
                fprintf(stderr, "❌ Failed to allocate memory for preprocessing\n");
                rd_kafka_message_destroy(rkmessage);
                continue;
            }

            json_error_t error;
            // 3. Load the preprocessed, trimmed JSON string
            json_t *root = json_loads(preprocessed, JSON_REJECT_DUPLICATES, &error);
            free(preprocessed);

            if (!root) {
                fprintf(stderr, "❌ Failed to parse message: %s\n", error.text);
                rd_kafka_message_destroy(rkmessage);
                continue;
            }

            if (json_is_object(root)) {
                set_current_timestamp(root);
                char *json_str = json_dumps(root, 0);
                if (json_str) {
                    json_buffer[buffer_count++] = json_str;
                }
            } else {
                fprintf(stderr, "❌ Expected JSON object.\n");
            }

            json_decref(root);

            // flush if buffer full
            if (buffer_count >= BULK_SIZE) {
                send_bulk_to_opensearch(json_buffer, buffer_count);

                for (int i = 0; i < buffer_count; i++) free(json_buffer[i]);
                buffer_count = 0;
                last_flush = time(NULL);
            }
        }

        rd_kafka_message_destroy(rkmessage);
    }

    // flush remaining docs on exit
    if (buffer_count > 0) {
        send_bulk_to_opensearch(json_buffer, buffer_count);
        for (int i = 0; i < buffer_count; i++) free(json_buffer[i]);
    }

    free(json_buffer);

    rd_kafka_consumer_close(rk);
    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_destroy(rk);

    return 0;
}