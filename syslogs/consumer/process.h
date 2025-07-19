#ifndef PROCESS_H
#define PROCESS_H

#include <librdkafka/rdkafka.h>

void process_message(rd_kafka_t *rk);

extern pthread_mutex_t severity_mutex;

#endif