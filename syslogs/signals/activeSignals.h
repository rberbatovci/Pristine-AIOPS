#ifndef ACTIVESIGNALS_H
#define ACTIVESIGNALS_H

#include <jansson.h>
#include "rules.h"

typedef struct {
    int id;
    char mnemonics[3][64];
    int mnemonic_count;
    char device[128];
    char startTime[64];
    char endTime[64];
    char status[32];
    char severity[32];
    char event_ids[100][64];
    int event_count;
    json_t *affectedEntities;
    char rule[32];
} ActiveSignal;

extern ActiveSignal active_signals[];
extern int active_signal_count;

int findActiveSignals(ActiveSignal *signal, const char *target_device, const char *target_mnemonic, json_t *target_entities);
void createSignal(StatefulRule *rule, const char *device, const char *mnemonic, json_t *tags, const char *event_id_str);
void closeSignal(ActiveSignal *signal);
void flushOpensearchBulkData();

#endif
