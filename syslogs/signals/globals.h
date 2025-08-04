#ifndef GLOBALS_H
#define GLOBALS_H

#define UUID_STRING_LENGTH 37
#define MAX_EVENTS_PER_SIGNAL 1000
#define MAX_ACTIVE_SIGNALS 1000

#include <jansson.h>
#include <librdkafka/rdkafka.h>
#include <pthread.h>
#include <libpq-fe.h>
#include <hiredis/hiredis.h>

typedef struct {
    char signalId[UUID_STRING_LENGTH];
    char mnemonics[3][64];
    int mnemonic_count;
    char device[128];
    char startTime[64];
    char endTime[64];
    char status[32];
    char severity[32];
    char events[100][64];
    int event_count;
    time_t status_changed_at;
    json_t *affectedEntities;
    char rule[32];
} ActiveSignal;

typedef struct StatefulRule {
    int id;
    char name[256];
    char openMnemonic[256];
    char closeMnemonic[256];
    char openTag[256];
    char openValue[256];
    char closeTag[256];
    char closeValue[256];
    char severity[256];
    char description[1024];
    int warmup;
    int cooldown;
    char *affectedEntityJson;  
} StatefulRule;

typedef enum {
    MATCH_NONE,
    MATCH_OPEN,
    MATCH_CLOSE
} MatchType;

typedef struct {
    StatefulRule *rule;
    MatchType match_type;
} RuleMatch;

typedef struct {
    int interval_seconds;
} ReloadArgs;

extern ActiveSignal active_signals[MAX_EVENTS_PER_SIGNAL];
extern int active_signal_count;

void activeSignalMonitor();
void queue_signal_status_update(ActiveSignal *sig, char **bulk, const char *index_name, const char *endTimeStr);
int findActiveSignals(ActiveSignal *signal, const char *target_device, const char *target_mnemonic, json_t *target_entities);
void createSignal(StatefulRule *rule, const char *device, const char *mnemonic, json_t *tags, const char *event_id_str, const char *timestamp);
void closeSignal(const char *signalId, const char *eventId, const char *timestamp);
void reopenSignal(ActiveSignal *signal, const char *eventIdStr, const char *timestamp);

int on_startup_redis(const char *redis_host, int redis_port);
int store_signal_in_redis(redisContext *ctx, const ActiveSignal *signal);
int load_active_signals_from_redis(redisContext *c);
void delete_signal_from_redis(const char *signalId);

void flushOpensearchBulkData();
void printSignal(const ActiveSignal *signal);
void create_syslog_signals_index();

void add_to_bulk_payload(const ActiveSignal *signal);

void process_message(rd_kafka_t *rk);
void send_bulk_to_opensearch(const char *bulk_payload);

extern StatefulRule *signal_rules;
extern int signal_rule_count;
extern redisContext *redis_ctx;

void loadSignalRules(PGconn *conn);
void free_signal_rules(void);

StatefulRule *findRuleByName(const char *name);
void printRule(StatefulRule *rule);
RuleMatch *findSignalRule(const char *mnemonic, json_t *tags, int *match_count);

void* reload_data_thread(void *arg);

#endif
