#ifndef PROCESS_H
#define PROCESS_H

#include <librdkafka/rdkafka.h>

void process_message(rd_kafka_t *rk, rd_kafka_t *signal_producer);

#endif