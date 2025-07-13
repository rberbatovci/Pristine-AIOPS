#ifndef PROCESS_H
#define PROCESS_H

#include <librdkafka/rdkafka.h>

void process_kafka_message_loop(rd_kafka_t *rk);

extern pthread_mutex_t severity_mutex;

#endif