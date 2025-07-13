#include <stdio.h>
#include <unistd.h>
#include <time.h>
#include "config.h"
#include <libpq-fe.h>
#include <stdlib.h>
#include <string.h>
#include "regex.h"

MnemonicCache *cache = NULL;
int cache_size = 0;
Regex *regexes = NULL;
int regex_count = 0;

int signal_severity = 5;

pthread_mutex_t config_mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t severity_mutex = PTHREAD_MUTEX_INITIALIZER;

void perform_reload() {
    time_t now = time(NULL);
    printf("[INFO] [Config Data] Reloading config at %s", ctime(&now));
}


void free_mnemonic_cache(void) {
    for (int i = 0; i < cache_size; i++) {
        free(cache[i].mnemonic);
        free(cache[i].info.severity);
        for (int j = 0; j < cache[i].info.regex_count; j++) {
            free(cache[i].info.regexes[j]);
        }
        free(cache[i].info.regexes);
    }
    free(cache);
    cache = NULL;
    cache_size = 0;
}

void load_mnemonics(PGconn *conn) {
    free_mnemonic_cache();

    PGresult *res = PQexec(conn,
        "SELECT "
        "  m.name, "
        "  m.severity, "
        "  m.level, "
        "  m.alert, "
        "  ARRAY( "
        "    SELECT regex.name "
        "    FROM mnemonic_regex mr "
        "    JOIN regex ON regex.id = mr.regex_id "
        "    WHERE mr.mnemonic_id = m.id "
        "  ) AS regexes "
        "FROM mnemonics m");

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Failed to fetch mnemonics: %s\n", PQerrorMessage(conn));
        PQclear(res);
        PQfinish(conn);
        return;
    }

    int rows = PQntuples(res);
    for (int row = 0; row < rows; row++) {
        cache = realloc(cache, sizeof(MnemonicCache) * (cache_size + 1));
        int i = cache_size++;

        cache[i].mnemonic = strdup(PQgetvalue(res, row, 0));
        cache[i].info.severity = strdup(PQgetvalue(res, row, 1));

        char level_str[12];
        snprintf(level_str, sizeof(level_str), "%d", atoi(PQgetvalue(res, row, 2)));
        cache[i].info.level = atoi(level_str);

        char *alert_str = PQgetvalue(res, row, 3);
        cache[i].info.alert = (alert_str[0] == 't');

        // Parse regex array
        char *regex_array = PQgetvalue(res, row, 4);
        cache[i].info.regex_count = 0;
        cache[i].info.regexes = NULL;

        if (regex_array && regex_array[0] == '{') {
            char *copy = strdup(regex_array);
            char *p = copy + 1;
            char *end = strchr(copy, '}');
            if (end) *end = '\0';

            char *token = strtok(p, ",");
            while (token) {
                while (*token == ' ' || *token == '"') token++;
                char *tend = token + strlen(token) - 1;
                while (tend > token && (*tend == ' ' || *tend == '"')) *tend-- = '\0';

                cache[i].info.regexes = realloc(cache[i].info.regexes, sizeof(char*) * (cache[i].info.regex_count + 1));
                cache[i].info.regexes[cache[i].info.regex_count++] = strdup(token);

                token = strtok(NULL, ",");
            }
            free(copy);
        }
    }

    PQclear(res);
    printf("[INFO] [Config Data] Loaded %d mnemonics from PostgreSQL into cache\n", cache_size);
}

void load_regexes(PGconn *conn) {
    PGresult *res = PQexec(conn, "SELECT name, pattern, matchfunction, matchnumber, groupnumber, nomatch, tag FROM regex");

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Failed to fetch regexes: %s\n", PQerrorMessage(conn));
        PQclear(res);
        return;
    }

    regex_count = PQntuples(res);
    regexes = malloc(sizeof(Regex) * regex_count);
    if (!regexes) {
        fprintf(stderr, "[ERROR] [Config Data] Failed to allocate memory for regex cache\n");
        PQclear(res);
        return;
    }

    for (int i = 0; i < regex_count; i++) {
        regexes[i].name = strdup(PQgetvalue(res, i, 0));
        regexes[i].pattern = strdup(PQgetvalue(res, i, 1));
        regexes[i].matchfunction = strdup(PQgetvalue(res, i, 2));
        regexes[i].matchnumber = PQgetisnull(res, i, 3) ? -1 : atoi(PQgetvalue(res, i, 3));
        regexes[i].groupnumber = PQgetisnull(res, i, 4) ? -1 : atoi(PQgetvalue(res, i, 4));
        regexes[i].nomatch = strdup(PQgetvalue(res, i, 5));
        regexes[i].tag = strdup(PQgetvalue(res, i, 6));
    }

    PQclear(res);
    printf("[INFO] [Config Data] Loaded %d regexes from PostgreSQL\n", regex_count);
}

void load_severity(PGconn *conn) {
    PGresult *res = PQexec(conn, "SELECT number FROM syslogsignalseverity ORDER BY id LIMIT 1;");

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Failed to fetch severity: %s\n", PQerrorMessage(conn));
        PQclear(res);
        PQfinish(conn);
        return;
    }

    if (PQntuples(res) > 0) {
        int new_severity = atoi(PQgetvalue(res, 0, 0));

        signal_severity = new_severity;
        printf("[INFO] [Config Data] Updated signal_severity to: %d\n", new_severity);
    }

    PQclear(res);
}

void* reload_data_thread(void* args) {
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    ReloadArgs* reload_args = (ReloadArgs*)args;

    while (1) {
        pthread_mutex_lock(&config_mutex);

        load_mnemonics(conn);
        load_regexes(conn);
        load_severity(conn);

        pthread_mutex_unlock(&config_mutex);

        sleep(reload_args->interval_seconds);
    }

    return NULL;
}


MnemonicInfo *get_mnemonic_from_cache(const char *mnemonic) {
    for (int i = 0; i < cache_size; i++) {
        if (strcmp(cache[i].mnemonic, mnemonic) == 0) {
            return &cache[i].info;
        }
    }
    return NULL; 
}

MnemonicInfo *fetch_mnemonic_from_db(const char *mnemonic) {
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    const char *paramValues[1] = { mnemonic };
    PGresult *res = PQexecParams(conn,
        "SELECT "
        "  m.name, "
        "  m.severity, "
        "  m.level, "
        "  m.alert, "  // Use alert field directly
        "  ARRAY( "
        "    SELECT regex.name "
        "    FROM mnemonic_regex mr "
        "    JOIN regex ON regex.id = mr.regex_id "
        "    WHERE mr.mnemonic_id = m.id "
        "  ) AS regexes "
        "FROM mnemonics m WHERE m.name = $1",
        1, NULL, paramValues, NULL, NULL, 0);

    if (PQresultStatus(res) != PGRES_TUPLES_OK || PQntuples(res) == 0) {
        PQclear(res);
        PQfinish(conn);
        return NULL;
    }

    cache = realloc(cache, sizeof(MnemonicCache) * (cache_size + 1));
    int i = cache_size++;

    cache[i].mnemonic = strdup(PQgetvalue(res, 0, 0));
    cache[i].info.severity = strdup(PQgetvalue(res, 0, 1));
    cache[i].info.level = atoi(PQgetvalue(res, 0, 2));

    // PQgetvalue returns "t" or "f" for boolean
    char *alert_str = PQgetvalue(res, 0, 3);
    cache[i].info.alert = (alert_str[0] == 't');

    // Parse regex array
    char *regex_array = PQgetvalue(res, 0, 4);
    cache[i].info.regex_count = 0;
    cache[i].info.regexes = NULL;

    printf("[DEBUG] [Config Data] Processing mnemonic: %s\n", PQgetvalue(res, 0, 0));
    printf("[DEBUG] [Config Data] Regex array string: %s\n", regex_array);

    if (regex_array && regex_array[0] == '{') {
        char *copy = strdup(regex_array);
        char *p = copy + 1;
        char *end = strchr(copy, '}');
        if (end) *end = '\0';

        char *token = strtok(p, ",");
        int regex_index = 0;
        while (token) {
            while (*token == ' ' || *token == '"') token++;
            char *tend = token + strlen(token) - 1;
            while (tend > token && (*tend == ' ' || *tend == '"')) *tend-- = '\0';

            printf("[DEBUG] [Config Data] Parsed regex[%d]: %s\n", regex_index++, token);

            cache[i].info.regexes = realloc(cache[i].info.regexes, sizeof(char*) * (cache[i].info.regex_count + 1));
            cache[i].info.regexes[cache[i].info.regex_count++] = strdup(token);

            token = strtok(NULL, ",");
        }
        free(copy);
    }

    PQclear(res);
    PQfinish(conn);

    return &cache[i].info;
}

MnemonicInfo *create_mnemonic_and_cache(const char *mnemonic) {
    const char *default_severity = "warning";
    int default_level = 1;

    char extracted_severity[32];
    int extracted_level;

    // Try extracting severity from the mnemonic
    if (!extract_severity(mnemonic, extracted_severity, sizeof(extracted_severity), &extracted_level)) {
        strcpy(extracted_severity, default_severity);
        extracted_level = default_level;
        printf("[INFO] [Config Data] Using default severity and level for '%s'\n", mnemonic);
    }

    // Connect to DB
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    char level_str[12];
    snprintf(level_str, sizeof(level_str), "%d", extracted_level);
    const char *paramValues[4] = { mnemonic, extracted_severity, level_str, "false" };  // set alert default to false on insert

    // Insert mnemonic with alert field set to false by default
    PGresult *res = PQexecParams(conn,
        "INSERT INTO mnemonics (name, severity, level, alert) VALUES ($1, $2, $3, $4) RETURNING id",
        4, NULL, paramValues, NULL, NULL, 0);

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] [Config Data] Failed to insert mnemonic: %s\n", PQerrorMessage(conn));
        PQclear(res);
        PQfinish(conn);
        return NULL;
    }

    PQclear(res);
    PQfinish(conn);

    // Expand cache
    cache = realloc(cache, sizeof(MnemonicCache) * (cache_size + 1));
    int i = cache_size++;

    cache[i].mnemonic = strdup(mnemonic);
    cache[i].info.severity = strdup(extracted_severity);
    cache[i].info.level = extracted_level;
    cache[i].info.alert = false;  // alert is boolean now
    cache[i].info.regexes = NULL;
    cache[i].info.regex_count = 0;

    printf("[INFO] [Config Data] Created new mnemonic '%s' with severity '%s' (level %d) and cached\n", mnemonic, extracted_severity, extracted_level);

    return &cache[i].info;
}

MnemonicInfo *findMnemonic(const char *mnemonic) {
    printf("[DEBUG] [Config Data] Checking cache for mnemonic: %s\n", mnemonic);
    MnemonicInfo *info = get_mnemonic_from_cache(mnemonic);
    if (info) {
        printf("[DEBUG] [Config Data] Found mnemonic in cache: %s\n", mnemonic);
        return info;
    }

    printf("[DEBUG] [Config Data] Mnemonic not found in cache. Trying DB: %s\n", mnemonic);
    info = fetch_mnemonic_from_db(mnemonic);
    if (info) {
        printf("[DEBUG] Found mnemonic in database: %s\n", mnemonic);
        return info;
    }

    printf("[DEBUG] [Config Data] Mnemonic not found in DB. Creating new entry: %s\n", mnemonic);
    return create_mnemonic_and_cache(mnemonic);
}

