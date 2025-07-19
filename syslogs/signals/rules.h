#ifndef RULES_H
#define RULES_H

#include <jansson.h>
#include <pthread.h>
#include <libpq-fe.h>  // For PGconn

// Rule structure definition
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
    char *affectedEntityJson;  // allocated string
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

// Global rule cache
extern StatefulRule *signal_rules;
extern int signal_rule_count;

// Rule management
void load_signal_rules(PGconn *conn);
void free_signal_rules(void);

// Rule lookup
void printRule(StatefulRule *rule);
RuleMatch *findSignalRule(const char *mnemonic, json_t *tags, int *match_count);

// Thread function
void* reload_data_thread(void *arg);

#endif
