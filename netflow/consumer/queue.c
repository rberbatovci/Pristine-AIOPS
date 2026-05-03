#include "globals.h"
#include <stdlib.h>

void queue_init(queue_t *q) {
    q->head = q->tail = NULL;
    q->closed = false;
    pthread_mutex_init(&q->mutex, NULL);
    pthread_cond_init(&q->cond, NULL);
}

void queue_push(queue_t *q, char *data) {
    node_t *node = malloc(sizeof(node_t));
    node->data = data;
    node->next = NULL;

    pthread_mutex_lock(&q->mutex);

    if (q->closed) {
        pthread_mutex_unlock(&q->mutex);
        free(node);
        return;
    }

    if (q->tail) {
        q->tail->next = node;
        q->tail = node;
    } else {
        q->head = q->tail = node;
    }

    pthread_cond_signal(&q->cond);
    pthread_mutex_unlock(&q->mutex);
}

char *queue_pop(queue_t *q) {
    pthread_mutex_lock(&q->mutex);

    while (!q->head && !q->closed) {
        pthread_cond_wait(&q->cond, &q->mutex);
    }

    if (!q->head) {
        pthread_mutex_unlock(&q->mutex);
        return NULL; // queue closed and empty
    }

    node_t *node = q->head;
    q->head = node->next;

    if (!q->head) {
        q->tail = NULL;
    }

    pthread_mutex_unlock(&q->mutex);

    char *data = node->data;
    free(node);
    return data;
}

void queue_close(queue_t *q) {
    pthread_mutex_lock(&q->mutex);
    q->closed = true;
    pthread_cond_broadcast(&q->cond);
    pthread_mutex_unlock(&q->mutex);
}