#ifndef PROCESS_H
#define PROCESS_H

#include <jansson.h>
#include <librdkafka/rdkafka.h>

void process_message(rd_kafka_t *rk);


#endif