#ifndef BULK_H
#define BULK_H

#include <jansson.h>
#include <librdkafka/rdkafka.h>

#define BULK_LIMIT 1

extern json_t *opensearch_events_buffer[BULK_LIMIT];
extern int opensearch_events_count;

extern json_t *kafka_signals_buffer[BULK_LIMIT];
extern int kafka_signals_count;

rd_kafka_t *init_kafka_alert_producer(const char *brokers);

void add_to_kafka_bulk(json_t *alert_json, rd_kafka_t *producer, const char *topic);
void send_bulk_to_kafka(void);
void send_bulk_to_opensearch(json_t **docs, int doc_count);

void add_alert_to_kafka_bulk(json_t *alert_json);

void load_env_config();
extern int DATA_FLUSH_SIZE;
extern int DATA_FLUSH_INTERVAL;

#endif  