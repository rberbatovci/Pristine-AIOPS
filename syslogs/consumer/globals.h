#ifndef GLOBALS_H
#define GLOBALS_H

#include <jansson.h>
#include <librdkafka/rdkafka.h>
#include <pthread.h>
#include <stdbool.h>
#include <libpq-fe.h>
#include <stdbool.h>

#define DATA_FLUSH_SIZE 1000
#define DATA_FLUSH_INTERVAL 5

#define KAFKA_SIGNALS_TOPIC "syslog-signals"

typedef struct {
    int interval_seconds;
} ReloadArgs;

typedef struct SyslogEvent {
    char eventId[37];
    char device[256];
    int lsn;
    char severity[16];
    char mnemonic[64];
    char timestamp[64];
    json_t *tags;
    char message[2048];
} SyslogEvent;

typedef struct {
    char *name;
    char *pattern;
    char *matchfunction;
    int matchnumber;
    int groupnumber;
    char *nomatch;
    char *tag;
} Regex;

extern Regex *regex_cache;
extern size_t regex_cache_size;

typedef struct {
    char *severity;
    bool alert;
    int level;
    char **regexes;
    int regex_count;
} MnemonicInfo;

typedef struct {
    char *mnemonic;
    MnemonicInfo info;
} MnemonicCache;

extern MnemonicCache *mnemonic_cache;
extern size_t mnemonic_cache_size;


MnemonicInfo* findMnemonic(const char *mnemonic);

void process_message(rd_kafka_t *rk, rd_kafka_t *signal_producer);

extern MnemonicCache *cache;
extern int cache_size;
extern Regex *regexes;
extern int regex_count;
extern int signal_severity;

int get_mnemonic_regexes(const char *name, Regex **out, int max_count);
char *extract_tags(const Regex *r, const char *message);
bool extract_mnemonic(const char *message, char *mnemonic_out, size_t mnemonic_size);
void extract_timestamp(const char *message, char *timestamp_out, size_t timestamp_size);
bool extract_severity(const char *mnemonic, char *severity_name_out, size_t severity_name_size, int *severity_level_out);


void load_env_config(); 
void* reload_data_thread(void* args);
void load_mnemonics_from_postgres(PGconn *conn);
void load_regexes_from_psql(PGconn *conn);
void load_severity(PGconn *conn);

rd_kafka_t *init_signal_producer(const char *brokers);
void add_alert_to_kafka_bulk(json_t *alert_json, rd_kafka_t *signal_producer);
void send_bulk_to_kafka(rd_kafka_t *signal_producer);
void send_bulk_to_opensearch(json_t **docs, int doc_count);
void create_syslogs_index();

extern json_t *opensearch_events_buffer[DATA_FLUSH_SIZE];
extern int opensearch_events_count;
extern json_t *kafka_signals_buffer[DATA_FLUSH_SIZE];
extern int kafka_signals_count;

extern rd_kafka_t *kafka_producer;

extern pthread_mutex_t config_mutex;
extern pthread_mutex_t severity_mutex;

#endif