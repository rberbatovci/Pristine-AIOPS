#include <stdio.h>
#include <unistd.h>
#include <time.h>
#include "config.h"
#include <libpq-fe.h>
#include <stdlib.h>
#include <string.h>
#include "regex.h"

SNMPTrapOID *trapOids = NULL;
int trapOidCount = 0;
SNMPTrapTag *trapTags = NULL;
int trapTagCount = 0;

pthread_mutex_t config_mutex = PTHREAD_MUTEX_INITIALIZER;

void* reload_data_thread(void* args) {
    ReloadArgs* reload_args = (ReloadArgs*)args;

    const char *conninfo = "host=localhost dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Failed to connect to database: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    while (1) {
        pthread_mutex_lock(&config_mutex);

        load_trap_oids(conn);
        load_trap_tags(conn);

        pthread_mutex_unlock(&config_mutex);
        sleep(reload_args->interval_seconds);
    }

    PQfinish(conn);
    return NULL;
}

void load_trap_oids(PGconn *conn) {
    const char *query = "SELECT name, value, tags FROM snmp_trap_oids";
    PGresult *res = PQexec(conn, query);

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] Failed to fetch trap OIDs: %s\n", PQerrorMessage(conn));
        PQclear(res);
        return;
    }

    // Free old cache
    for (int i = 0; i < trapOidCount; i++) {
        free(trapOids[i].name);
        free(trapOids[i].value);
        for (int j = 0; j < trapOids[i].tag_count; j++) {
            free(trapOids[i].tags[j]);
        }
        free(trapOids[i].tags);
    }
    free(trapOids);

    trapOidCount = PQntuples(res);
    trapOids = malloc(sizeof(SNMPTrapOID) * trapOidCount);

    for (int i = 0; i < trapOidCount; i++) {
        trapOids[i].name = strdup(PQgetvalue(res, i, 0));
        trapOids[i].value = strdup(PQgetvalue(res, i, 1));
        trapOids[i].tags = NULL;
        trapOids[i].tag_count = 0;
        trapOids[i].alert = false; // default

        char *tags_raw = PQgetvalue(res, i, 2);
        if (tags_raw && strlen(tags_raw) > 2) {
            char *tags_clean = strdup(tags_raw + 1);
            tags_clean[strlen(tags_clean) - 1] = '\0';

            char *token = strtok(tags_clean, ",");
            while (token) {
                trapOids[i].tags = realloc(trapOids[i].tags, sizeof(char*) * (trapOids[i].tag_count + 1));
                trapOids[i].tags[trapOids[i].tag_count++] = strdup(token);
                token = strtok(NULL, ",");
            }
            free(tags_clean);
        }
    }

    PQclear(res);

    // Print for deployment
    printf("=== Loaded SNMP Trap OIDs (%d entries) ===\n", trapOidCount);
    for (int i = 0; i < trapOidCount; i++) {
        printf("OID %d:\n", i + 1);
        printf("  Name: %s\n", trapOids[i].name ? trapOids[i].name : "(null)");
        printf("  Value: %s\n", trapOids[i].value);
        printf("  Tags: ");
        for (int j = 0; j < trapOids[i].tag_count; j++) {
            printf("%s%s", trapOids[i].tags[j], (j < trapOids[i].tag_count - 1) ? ", " : "");
        }
        printf("\n");
    }
}

void load_trap_tags(PGconn *conn) {
    const char *query = "SELECT name, oids FROM \"trapTags\"";
    PGresult *res = PQexec(conn, query);

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] Failed to fetch trap tags: %s\n", PQerrorMessage(conn));
        PQclear(res);
        return;
    }

    for (int i = 0; i < trapTagCount; i++) {
        free(trapTags[i].name);
        for (int j = 0; j < trapTags[i].oid_count; j++) {
            free(trapTags[i].oids[j]);
        }
        free(trapTags[i].oids);
    }
    free(trapTags);

    trapTagCount = PQntuples(res);
    trapTags = malloc(sizeof(SNMPTrapTag) * trapTagCount);

    for (int i = 0; i < trapTagCount; i++) {
        trapTags[i].name = strdup(PQgetvalue(res, i, 0));
        char *oids_raw = PQgetvalue(res, i, 1);

        trapTags[i].oids = NULL;
        trapTags[i].oid_count = 0;

        if (oids_raw && strlen(oids_raw) > 2) {
            char *oids_clean = strdup(oids_raw + 1);
            oids_clean[strlen(oids_clean) - 1] = '\0';

            char *token = strtok(oids_clean, ",");
            while (token) {
                trapTags[i].oids = realloc(trapTags[i].oids, sizeof(char*) * (trapTags[i].oid_count + 1));
                trapTags[i].oids[trapTags[i].oid_count++] = strdup(token);
                token = strtok(NULL, ",");
            }
            free(oids_clean);
        }
    }

    PQclear(res);
}

void free_snmpTrapOid(SNMPTrapOID *oid) {
    if (!oid) return;
    free(oid->name);
    free(oid->value);
    for (int i = 0; i < oid->tag_count; i++) {
        free(oid->tags[i]);
    }
    free(oid->tags);
    free(oid);
}

SNMPTrapOID *fetch_snmpTrapOid_from_db(PGconn *conn, const char *snmpTrapOid) {
    const char *paramValues[1] = { snmpTrapOid };
    const char *query = "SELECT name, value, tags FROM snmp_trap_oids WHERE value = $1";
    PGresult *res = PQexecParams(conn, query, 1, NULL, paramValues, NULL, NULL, 0);

    if (PQresultStatus(res) != PGRES_TUPLES_OK || PQntuples(res) == 0) {
        PQclear(res);
        return NULL;
    }

    SNMPTrapOID *result = malloc(sizeof(SNMPTrapOID));
    result->name = strdup(PQgetvalue(res, 0, 0));
    result->value = strdup(PQgetvalue(res, 0, 1));
    result->tags = NULL;
    result->tag_count = 0;
    result->alert = false; // default

    char *tags_raw = PQgetvalue(res, 0, 2);
    if (tags_raw && strlen(tags_raw) > 2) {
        char *tags_clean = strdup(tags_raw + 1);
        tags_clean[strlen(tags_clean) - 1] = '\0';

        char *token = strtok(tags_clean, ",");
        while (token) {
            result->tags = realloc(result->tags, sizeof(char*) * (result->tag_count + 1));
            result->tags[result->tag_count++] = strdup(token);
            token = strtok(NULL, ",");
        }
        free(tags_clean);
    }

    PQclear(res);
    return result;
}

SNMPTrapOID *create_snmpTrapOid_and_cache(const char *snmpTrapOid) {
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
    const char *paramValues[3] = { mnemonic, extracted_severity, level_str };

    PGresult *res = PQexecParams(conn,
        "INSERT INTO mnemonics (name, severity, level) VALUES ($1, $2, $3) RETURNING id",
        3, NULL, paramValues, NULL, NULL, 0);

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
    cache[i].info.alert = strdup("drop");
    cache[i].info.regexes = NULL;
    cache[i].info.regex_count = 0;

    printf("[INFO] [Config Data] Created new mnemonic '%s' with severity '%s' (level %d) and cached\n", mnemonic, extracted_severity, extracted_level);

    return &cache[i].info;
}

SNMPTrapOID *findSnmpTrapOid(const char *snmpTrapOid) {
    printf("[DEBUG] [Config Data] Checking cache for mnemonic: %s\n", mnemonic);

    for (int i = 0; i < cache_size; i++) {
        if (strcmp(cache[i].mnemonic, mnemonic) == 0) {
            printf("[DEBUG] [Config Data] Found mnemonic in cache: %s\n", mnemonic);
            return &cache[i].info;
        }
    }

    printf("[DEBUG] [Config Data] Mnemonic not found in cache. Trying DB: %s\n", mnemonic);

    SNMPTrapOID *info = fetch_mnemonic_from_db(mnemonic);
    if (info) {
        printf("[DEBUG] [Config Data] Found mnemonic in database: %s\n", mnemonic);
        return info;
    }

    printf("[DEBUG] [Config Data] Mnemonic not found in DB. Creating new entry: %s\n", mnemonic);
    return create_mnemonic_and_cache(mnemonic);
}
