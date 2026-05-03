#include "globals.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
#include <ctype.h>

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