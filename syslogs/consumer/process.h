#ifndef PROCESS_H
#define PROCESS_H

#include <jansson.h> 
#include <librdkafka/rdkafka.h>

typedef struct SyslogEvent {
    char eventId[37];
    char device[256];
    int lsn;
    char severity[16];
    char mnemonic[64];
    char timestamp[64];
    json_t *tags;         // Use a json_t* for easy serialization
    char message[2048];
} SyslogEvent;

void process_message(rd_kafka_t *rk);

extern pthread_mutex_t severity_mutex;

#endif