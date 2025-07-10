#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <librdkafka/rdkafka.h>
#include <curl/curl.h>
#include <jansson.h>
#include <signal.h>
#include <unistd.h>

#define OPENSEARCH_URL "http://OpenSearch:9200/netflow/_doc/"
#define TOPIC_NAME "netflow-topic"

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

void send_to_opensearch(const char *json_data) {
    CURL *curl;
    CURLcode res;
    struct curl_slist *headers = NULL;
    struct response_string response;

    init_string(&response);
    curl_global_init(CURL_GLOBAL_ALL);
    curl = curl_easy_init();

    if (curl) {
        headers = curl_slist_append(headers, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_URL, OPENSEARCH_URL);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_data);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, writefunc);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

        res = curl_easy_perform(curl);
        if (res != CURLE_OK) {
            fprintf(stderr, "❌ curl_easy_perform() failed: %s\n", curl_easy_strerror(res));
        } else {
            long response_code;
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
            if (response_code == 200 || response_code == 201) {
                json_error_t error;
                json_t *root = json_loads(response.ptr, 0, &error);
                if (root) {
                    const char *result = json_string_value(json_object_get(root, "result"));
                    if (result && (strcmp(result, "created") == 0 || strcmp(result, "updated") == 0)) {
                        printf("✅ Data successfully stored in OpenSearch.\n");
                    } else {
                        fprintf(stderr, "⚠️ Unexpected OpenSearch response: %s\n", response.ptr);
                    }
                    json_decref(root);
                } else {
                    fprintf(stderr, "⚠️ Failed to parse OpenSearch response: %s\n", error.text);
                }
            } else {
                fprintf(stderr, "❌ OpenSearch HTTP error %ld\nResponse: %s\n", response_code, response.ptr);
            }
        }
        curl_easy_cleanup(curl);
        curl_slist_free_all(headers);
    }
    curl_global_cleanup();
    free(response.ptr);
}

// Function to convert a timestamp (in nanoseconds?) to ISO 8601 format
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

int main() {

    signal(SIGINT, handle_sigterm);
    signal(SIGTERM, handle_sigterm);

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

    while (keep_running) {
        rd_kafka_message_t *rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage) continue;

        if (rkmessage->err) {
            fprintf(stderr, "⚠️ Kafka error: %s\n", rd_kafka_message_errstr(rkmessage));
        } else {
            printf("📥 Received raw message: %.*s\n", (int)rkmessage->len, (char *)rkmessage->payload);
            json_error_t error;
            json_t *root = json_loadb((char *)rkmessage->payload, rkmessage->len, JSON_REJECT_DUPLICATES, &error);

            if (!root) {
                char safe_payload[512];
                int len = (int)(rkmessage->len > 200 ? 200 : rkmessage->len);
                int j = 0;
                for (int i = 0; i < len && j < sizeof(safe_payload) - 1; i++) {
                    char c = ((char *)rkmessage->payload)[i];
                    if (c == '\"' || c == '\\') {
                        if (j < sizeof(safe_payload) - 2) {
                            safe_payload[j++] = '\\';
                        }
                    }
                    safe_payload[j++] = c;
                }
                safe_payload[j] = '\0';

                char *error_doc = NULL;
                asprintf(&error_doc, "{\"error\": \"Failed to parse message: %s\", \"raw_message\": \"%s\"}", error.text, safe_payload);
                if (error_doc) {
                    send_to_opensearch(error_doc);
                    free(error_doc);
                }
                rd_kafka_message_destroy(rkmessage);
                continue;
            }

            if (json_is_array(root)) {
                size_t index;
                json_t *entry;
                time_t now = time(NULL);
                struct tm *gmt = gmtime(&now);
                char iso_processing_timestamp[30];
                strftime(iso_processing_timestamp, sizeof(iso_processing_timestamp), "%Y-%m-%dT%H:%M:%SZ", gmt);

                json_array_foreach(root, index, entry) {
                    if (json_is_object(entry)) {
                        json_t *copy = json_deep_copy(entry);

                        json_t *first_ts = json_object_get(copy, "first_timestamp");
                        json_t *last_ts = json_object_get(copy, "last_timestamp");

                        char *first_ts_iso_str = timestamp_to_iso(first_ts);
                        char *last_ts_iso_str = timestamp_to_iso(last_ts);

                        json_object_set_new(copy, "first_timestamp_iso", json_string(first_ts_iso_str));
                        json_object_set_new(copy, "last_timestamp_iso", json_string(last_ts_iso_str));
                        json_object_set_new(copy, "@timestamp", json_string(iso_processing_timestamp));

                        // Remove the original large timestamp fields if you don't need them in OpenSearch
                        json_object_del(copy, "first_timestamp");
                        json_object_del(copy, "last_timestamp");

                        char *json_str = json_dumps(copy, 0);
                        if (json_str) {
                            printf("Sending to OpenSearch: %s\n", json_str);
                            send_to_opensearch(json_str);
                            free(json_str);
                        }
                        free(first_ts_iso_str);
                        free(last_ts_iso_str);
                        json_decref(copy);
                    }
                }
            } else {
                fprintf(stderr, "❌ Expected JSON array.\n");
            }
            json_decref(root);
        }
        rd_kafka_message_destroy(rkmessage);
    }

    rd_kafka_consumer_close(rk);
    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_destroy(rk);

    return 0;
}