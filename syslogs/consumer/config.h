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
    char *pattern;
    char *matchfunction;
    int matchnumber;
    int groupnumber;
    char *nomatch;
    char *tag;
} Regex;

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

MnemonicInfo* findMnemonic(const char *mnemonic);

// Shared resources
extern MnemonicCache *cache;
extern int cache_size;
extern Regex *regexes;
extern int regex_count;
extern int signal_severity;

// Mutex
extern pthread_mutex_t config_mutex;
extern pthread_mutex_t severity_mutex;

void* reload_data_thread(void* args);
void load_mnemonics_from_postgres(PGconn *conn);
void load_regexes_from_psql(PGconn *conn);
void load_severity(PGconn *conn);

#endif
