#ifndef GLOBALS_H
#define GLOBALS_H

#include <pthread.h>
#include <stdbool.h>
#include <stddef.h> 
#include <jansson.h>

typedef struct node {
    char *data;
    struct node *next;
} node_t;

typedef struct {
    node_t *head;
    node_t *tail;
    pthread_mutex_t mutex;
    pthread_cond_t cond;
    bool closed;
} queue_t;

// ✅ QUEUE FUNCTIONS
void queue_init(queue_t *q);
void queue_push(queue_t *q, char *data);
char *queue_pop(queue_t *q);
void queue_close(queue_t *q);

// ✅ GLOBAL QUEUES
extern queue_t raw_queue;
extern queue_t bulk_queue;

// ✅ THREAD CONFIG
#define WORKER_COUNT 4

// ✅ THREAD FUNCTIONS
void *worker_thread(void *arg);
void *bulk_sender_thread(void *arg);

// expose shared config
extern const char *opensearch_nodes[];
extern const int OPENSEARCH_NODE_COUNT;

// functions
void create_netflow_index();
void send_bulk_to_opensearch(char **json_docs, int doc_count);


// shared struct
struct response_string {
    char *ptr;
    size_t len;
};

// function declarations
char *preprocess_large_integers(const char *input, size_t len);
char *trim_json_payload(const char *raw_payload, size_t len);
char* timestamp_to_iso(json_t *ts_item);
void set_current_timestamp(json_t *root);

void init_string(struct response_string *s);
size_t writefunc(void *ptr, size_t size, size_t nmemb, struct response_string *s);



#endif