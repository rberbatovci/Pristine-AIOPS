// config_data.h

#ifndef CONFIG_H
#define CONFIG_H

#include <pthread.h>
#include <stdbool.h>
#include <libpq-fe.h>

typedef struct {
    int interval_seconds;
} ReloadArgs;

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

extern SNMPTrapOID *trapOids;
extern int trapOidCount;

extern SNMPTrapTag *trapTags;
extern int trapTagCount;

extern pthread_mutex_t config_mutex;

void* reload_data_thread(void* args);
void load_trap_oids(PGconn *conn);
void load_trap_tags(PGconn *conn);

#endif
