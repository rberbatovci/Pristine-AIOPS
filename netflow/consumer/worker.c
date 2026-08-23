#include "globals.h" 
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#define _XOPEN_SOURCE
#include <time.h>

#define BULK_SIZE 1000


void *worker_thread(void *arg) {
    (void)arg;

    while (1) {
        char *msg = queue_pop(&raw_queue);
        if (!msg) break;

        json_error_t error;
        json_t *root = json_loads(msg, 0, &error);

        if (!root) {
            printf("❌ JSON parse error: %s\n", error.text);
            queue_push(&bulk_queue, msg);
            continue;
        }

        const char *device = json_string_value(json_object_get(root, "device"));
        const char *src_ip = json_string_value(json_object_get(root, "source_ip"));
        const char *dst_ip = json_string_value(json_object_get(root, "dest_ip"));
        const char *protocol = json_string_value(json_object_get(root, "protocol"));
        int src_port = json_integer_value(json_object_get(root, "source_port"));
        int dst_port = json_integer_value(json_object_get(root, "dest_port"));
        
        // Extract ISO-8601 timestamp string from JSON
        const char *ts_str = json_string_value(json_object_get(root, "@timestamp"));
        time_t timestamp = 0;
        char formatted_time[64] = "N/A";

        if (ts_str) {
            struct tm tm_info = {0};
            // Parse ISO-8601 formatted string (e.g., 2026-08-15T15:41:14Z)
            if (strptime(ts_str, "%Y-%m-%dT%H:%M:%SZ", &tm_info) != NULL) {
                timestamp = timegm(&tm_info); 
                strftime(formatted_time, sizeof(formatted_time), "%Y-%m-%d %H:%M:%S UTC", &tm_info);
            } else { 
                snprintf(formatted_time, sizeof(formatted_time), "%s", ts_str);
            }
        }

        int bytes = json_integer_value(json_object_get(root, "bytes"));
        int packets = json_integer_value(json_object_get(root, "packets"));

        printf("📥 Flow: device=%s | %s:%d → %s:%d | protocol=%s | timestamp=%s (epoch: %ld) | bytes=%d | packets=%d\n",
               device, src_ip, src_port, dst_ip, dst_port, protocol, formatted_time, (long)timestamp, bytes, packets);

        json_decref(root);
        queue_push(&bulk_queue, msg);
    }

    return NULL;
}

void *bulk_sender_thread(void *arg) {
    (void)arg;

    char *batch[BULK_SIZE];
    int count = 0;

    while (1) {
        char *msg = queue_pop(&bulk_queue);

        if (!msg) { 
            if (count > 0) {
                send_bulk_to_opensearch(batch, count);
                for (int i = 0; i < count; i++) free(batch[i]);
            }
            break;
        }

        batch[count++] = msg;

        if (count >= BULK_SIZE) {
            send_bulk_to_opensearch(batch, count);

            for (int i = 0; i < count; i++) {
                free(batch[i]);
            }

            count = 0;
        }
    }

    return NULL;
}