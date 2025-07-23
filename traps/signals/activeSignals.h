#ifndef ACTIVESIGNALS_H
#define ACTIVESIGNALS_H

#define UUID_STRING_LENGTH 37

#include <jansson.h>
#include "rules.h"

typedef struct {
    char signalId[UUID_STRING_LENGTH];
    char snmpTrapOids[3][64];
    int snmpTrapOids_count;
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

extern ActiveSignal active_signals[];
extern int active_signal_count;

void activeSignalMonitor();
void queue_signal_status_update(ActiveSignal *sig, char **bulk, const char *index_name);
int findActiveSignals(ActiveSignal *signal, const char *target_device, const char *target_rule_name, json_t *target_entities);
void createSignal(StatefulRule *rule, const char *device, const char *snmpTrapOid, json_t *tags, const char *event_id_str);
void closeSignal(const char *signalId, const char *eventId);
void flushOpensearchBulkData();
void printSignal(const ActiveSignal *signal);

#endif
