#include "globals.h" 
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

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

        int bytes = json_integer_value(json_object_get(root, "bytes"));
        int packets = json_integer_value(json_object_get(root, "packets"));

        printf("📥 Flow: device=%s | %s → %s | bytes=%d | packets=%d\n",
               device, src_ip, dst_ip, bytes, packets);

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
            // queue closed → flush remaining
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