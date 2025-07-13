#ifndef BULK_H
#define BULK_H

#include <jansson.h>
#include <librdkafka/rdkafka.h>

#define BULK_LIMIT 1

extern json_t *opensearch_buffer[BULK_LIMIT];
extern int opensearch_count;

// Kafka initialization
rd_kafka_t *init_kafka_alert_producer(const char *brokers);

// Send individual alert JSON to Kafka topic
void send_alert_to_kafka(rd_kafka_t *producer, const char *topic, const char *json_alert);

// Send a batch of json_t* documents to OpenSearch via _bulk API
void send_bulk_to_opensearch(json_t **docs, int doc_count);

#endif  // BULK_H
