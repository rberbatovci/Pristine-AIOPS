#include <stdio.h>
#include <unistd.h>
#include <time.h>
#include <stdlib.h>
#include <string.h>
#include <libpq-fe.h>
#include <pthread.h>
#include "config.h"
#include "regex.h"

SNMPTrapOID *trapOids = NULL;
int trapOidCount = 0;
SNMPTrapTag *trapTags = NULL;
int trapTagCount = 0;

pthread_mutex_t config_mutex = PTHREAD_MUTEX_INITIALIZER;

void* reload_data_thread(void* args) {
    ReloadArgs* reload_args = (ReloadArgs*)args;
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
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
    const char *query = "SELECT id, name, value, alert FROM snmp_trap_oids";
    PGresult *res = PQexec(conn, query);

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] Failed to fetch trap OIDs: %s\n", PQerrorMessage(conn));
        PQclear(res);
        return;
    }

    // Free previous memory
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
        int oid_id = atoi(PQgetvalue(res, i, 0));
        trapOids[i].name = strdup(PQgetvalue(res, i, 1));
        trapOids[i].value = strdup(PQgetvalue(res, i, 2));
        trapOids[i].alert = strcmp(PQgetvalue(res, i, 3), "t") == 0;
        trapOids[i].tags = NULL;
        trapOids[i].tag_count = 0;

        // Load tags for this OID
        const char *tag_query = "SELECT tag_name FROM trap_oid_tags WHERE trap_oid_id = $1";
        const char *paramValues[1];
        char oid_id_str[12];
        snprintf(oid_id_str, sizeof(oid_id_str), "%d", oid_id);
        paramValues[0] = oid_id_str;

        PGresult *tag_res = PQexecParams(conn, tag_query, 1, NULL, paramValues, NULL, NULL, 0);
        if (PQresultStatus(tag_res) == PGRES_TUPLES_OK) {
            int tag_rows = PQntuples(tag_res);
            for (int j = 0; j < tag_rows; j++) {
                trapOids[i].tags = realloc(trapOids[i].tags, sizeof(char*) * (trapOids[i].tag_count + 1));
                trapOids[i].tags[trapOids[i].tag_count++] = strdup(PQgetvalue(tag_res, j, 0));
            }
        } else {
            fprintf(stderr, "[ERROR] Failed to load tags for OID id %d: %s\n", oid_id, PQerrorMessage(conn));
        }

        PQclear(tag_res);
    }

    PQclear(res);

    printf("=== Loaded SNMP Trap OIDs (%d entries) ===\n", trapOidCount);
    for (int i = 0; i < trapOidCount; i++) {
        printf("OID %d:\n", i + 1);
        printf("  Name: %s\n", trapOids[i].name);
        printf("  Value: %s\n", trapOids[i].value);
        printf("  Alert: %s\n", trapOids[i].alert ? "true" : "false");
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

    printf("=== Loaded SNMP Trap Tags (%d entries) ===\n", trapTagCount);

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

        printf("Tag %d:\n", i + 1);
        printf("  Name: %s\n", trapTags[i].name);
        printf("  OIDs: ");
        for (int j = 0; j < trapTags[i].oid_count; j++) {
            printf("%s%s", trapTags[i].oids[j], (j < trapTags[i].oid_count - 1) ? ", " : "");
        }
        printf("\n");
    }

    PQclear(res);
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
    result->alert = false;

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
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to DB failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    // Insert a new default OID if not exists
    const char *insertQuery = "INSERT INTO snmp_trap_oids (name, value, tags) VALUES ($1, $2, ARRAY[]::text[]) ON CONFLICT DO NOTHING";
    const char *defaultName = snmpTrapOid; // or provide another default name
    const char *paramValues[2] = { defaultName, snmpTrapOid };

    PGresult *res = PQexecParams(conn, insertQuery, 2, NULL, paramValues, NULL, NULL, 0);
    if (PQresultStatus(res) != PGRES_COMMAND_OK) {
        fprintf(stderr, "[ERROR] Failed to insert new snmpTrapOid: %s\n", PQerrorMessage(conn));
        PQclear(res);
        PQfinish(conn);
        return NULL;
    }
    PQclear(res);

    // Now fetch and return it
    SNMPTrapOID *result = fetch_snmpTrapOid_from_db(conn, snmpTrapOid);
    PQfinish(conn);
    return result;
}

SNMPTrapOID *findSnmpTrapOid(const char *snmpTrapOid) {
    printf("[DEBUG] Checking SNMP Trap OID in cache: %s\n", snmpTrapOid);

    // Check if the OID exists in the current cache
    for (int i = 0; i < trapOidCount; i++) {
        if (strcmp(trapOids[i].value, snmpTrapOid) == 0) {
            printf("[DEBUG] Found in cache: %s\n", snmpTrapOid);
            return &trapOids[i];
        }
    }

    printf("[DEBUG] Not found in cache, fetching from DB: %s\n", snmpTrapOid);

    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to DB failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    // Try to fetch from DB
    SNMPTrapOID *info = fetch_snmpTrapOid_from_db(conn, snmpTrapOid);
    PQfinish(conn);

    if (info) {
        printf("[DEBUG] Loaded from DB: %s\n", snmpTrapOid);
        return info;
    }

    // If not found in DB, create a new one (this function will fetch and return a new one from DB again)
    printf("[DEBUG] Not found in DB either. Creating new trap OID: %s\n", snmpTrapOid);
    return create_snmpTrapOid_and_cache(snmpTrapOid);
}