#ifndef GLOBALS_H
#define GLOBALS_H

#include <jansson.h> 
#include <librdkafka/rdkafka.h>
#include <pthread.h>
#include <stdbool.h>
#include <libpq-fe.h>
#include <jansson.h>
#include <librdkafka/rdkafka.h>

#define BULK_LIMIT 1
#define DATA_FLUSH_SIZE 1000
#define DATA_FLUSH_INTERVAL 5

#define KAFKA_SIGNALS_TOPIC "trap-signals"

typedef struct {
    int interval_seconds;
} ReloadArgs;

typedef struct TrapEvent {
    char eventId[37];
    char device[256];
    char sysUpTime[16];
    char snmpTrapOid[64];
    char timestamp[64];
    json_t *content;
} TrapEvent;

typedef struct {
    char *name;
    char *value;
    bool alert;
    char **tags;
    int tag_count;
} SNMPTrapOID;

typedef struct {
    char *name;
    char **oids;
    int oid_count;
} SNMPTrapTag;

SNMPTrapOID *findSnmpTrapOid(const char *oid);

void process_message(rd_kafka_t *consumer, rd_kafka_t *signal_producer);

void load_env_config();
void* reload_data_thread(void* args);
void load_trap_oids(PGconn *conn);
void load_trap_tags(PGconn *conn);

extern SNMPTrapOID *trapOids;
extern int trapOidCount;

extern SNMPTrapTag *trapTags;
extern int trapTagCount;

extern json_t *opensearch_events_buffer[DATA_FLUSH_SIZE];
extern int opensearch_events_count;

extern json_t *kafka_signals_buffer[DATA_FLUSH_SIZE];
extern int kafka_signals_count;

rd_kafka_t *init_signal_producer(const char *brokers);
void add_alert_to_kafka_bulk(json_t *alert_json, rd_kafka_t *signal_producer);
void send_bulk_to_kafka(rd_kafka_t *signal_producer);

void create_traps_index();
void send_bulk_to_opensearch(json_t **docs, int doc_count);

extern pthread_mutex_t config_mutex;

//extern rd_kafka_t *signal_producer;

#endif