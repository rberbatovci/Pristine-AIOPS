#include <jansson.h>
#include <stdio.h>
#include <unistd.h>
#include <time.h>
#include "rules.h"
#include <libpq-fe.h>
#include <stdlib.h>
#include <string.h>
#include "regex.h"

StatefulRule *signal_rules = NULL;
int signal_rule_count = 0;

pthread_mutex_t config_mutex = PTHREAD_MUTEX_INITIALIZER;

void perform_reload()
{
    time_t now = time(NULL);
    printf("[INFO] [Config Data] Reloading config at %s", ctime(&now));
}

void free_signal_rules(void)
{
    if (!signal_rules)
        return;

    for (int i = 0; i < signal_rule_count; i++)
    {
        free(signal_rules[i].affectedEntityJson);
    }
    free(signal_rules);
    signal_rules = NULL;
    signal_rule_count = 0;
}

void loadSignalRules(PGconn *conn)
{
    // Clean up old rules first
    free_signal_rules();

    const char *query =
        "SELECT r.id, r.name, "
        "om.name AS open_mnemonic, cm.name AS close_mnemonic, "
        "r.opensignaltag, r.opensignalvalue, "
        "r.closesignaltag, r.closesignalvalue, "
        "r.initialseverity, r.description, r.warmup, r.cooldown, "
        "COALESCE(r.affectedentity::text, '[]') AS affectedentity "
        "FROM stateful_syslog_rules r "
        "LEFT JOIN mnemonics om ON om.id = r.opensignalmnemonic_id "
        "LEFT JOIN mnemonics cm ON cm.id = r.closesignalmnemonic_id";

    PGresult *res = PQexec(conn, query);

    if (PQresultStatus(res) != PGRES_TUPLES_OK)
    {
        fprintf(stderr, "[ERROR] Failed to fetch stateful rules: %s\n", PQerrorMessage(conn));
        PQclear(res);
        signal_rules = NULL;
        signal_rule_count = 0;
        return;
    }

    int nrows = PQntuples(res);
    signal_rule_count = nrows;

    signal_rules = malloc(sizeof(StatefulRule) * nrows);
    if (!signal_rules)
    {
        fprintf(stderr, "[ERROR] Memory allocation for rules failed\n");
        PQclear(res);
        signal_rule_count = 0;
        return;
    }

    for (int i = 0; i < nrows; i++)
    {
        StatefulRule *rule = &signal_rules[i];

        rule->id = atoi(PQgetvalue(res, i, 0));
        strncpy(rule->name, PQgetvalue(res, i, 1), sizeof(rule->name));
        strncpy(rule->openMnemonic, PQgetvalue(res, i, 2), sizeof(rule->openMnemonic));
        strncpy(rule->closeMnemonic, PQgetvalue(res, i, 3), sizeof(rule->closeMnemonic));
        strncpy(rule->openTag, PQgetvalue(res, i, 4), sizeof(rule->openTag));
        strncpy(rule->openValue, PQgetvalue(res, i, 5), sizeof(rule->openValue));
        strncpy(rule->closeTag, PQgetvalue(res, i, 6), sizeof(rule->closeTag));
        strncpy(rule->closeValue, PQgetvalue(res, i, 7), sizeof(rule->closeValue));
        strncpy(rule->severity, PQgetvalue(res, i, 8), sizeof(rule->severity));
        strncpy(rule->description, PQgetvalue(res, i, 9), sizeof(rule->description));
        rule->warmup = atoi(PQgetvalue(res, i, 10));
        rule->cooldown = atoi(PQgetvalue(res, i, 11));

        const char *json_str = PQgetvalue(res, i, 12);
        rule->affectedEntityJson = strdup(json_str);

        ///printRule(rule);
    }

    PQclear(res);
    printf("[INFO] Loaded %d signal rules\n", signal_rule_count);
}

RuleMatch *findSignalRule(const char *mnemonic, json_t *tags, int *match_count)
{
    RuleMatch *matches = malloc(sizeof(RuleMatch) * signal_rule_count);
    *match_count = 0;

    for (int i = 0; i < signal_rule_count; i++)
    {
        if (strcmp(signal_rules[i].openMnemonic, mnemonic) == 0)
        {
            const char *key = signal_rules[i].openTag;
            const char *expected_value = signal_rules[i].openValue;

            json_t *value_json = json_object_get(tags, key);
            if (json_is_string(value_json))
            {
                const char *actual_value = json_string_value(value_json);
                if (strcmp(actual_value, expected_value) == 0)
                {
                    matches[*match_count].rule = &signal_rules[i];
                    matches[*match_count].match_type = MATCH_OPEN;
                    (*match_count)++;
                }
            }
        }

        if (strcmp(signal_rules[i].closeMnemonic, mnemonic) == 0)
        {
            const char *key = signal_rules[i].closeTag;
            const char *expected_value = signal_rules[i].closeValue;

            json_t *value_json = json_object_get(tags, key);
            if (json_is_string(value_json))
            {
                const char *actual_value = json_string_value(value_json);
                if (strcmp(actual_value, expected_value) == 0)
                {
                    matches[*match_count].rule = &signal_rules[i];
                    matches[*match_count].match_type = MATCH_CLOSE;
                    (*match_count)++;
                }
            }
        }
    }

    return matches;
}

void printRule(StatefulRule *rule) {
    if (!rule) {
        printf("[WARN] Rule is NULL.\n");
        return;
    }

    printf("\n--- Rule ID %d ---\n", rule->id);
    printf("    Name            : %s\n", rule->name);
    printf("    Open Mnemonic   : %s\n", rule->openMnemonic);
    printf("    Open Tag        : %s\n", rule->openTag);
    printf("    Open Value      : %s\n", rule->openValue);
    printf("    Close Mnemonic  : %s\n", rule->closeMnemonic);
    printf("    Close Tag       : %s\n", rule->closeTag);
    printf("    Close Value     : %s\n", rule->closeValue);
    printf("    Severity        : %s\n", rule->severity);
    printf("    Description     : %s\n", rule->description);
    printf("    Warmup (sec)    : %d\n", rule->warmup);
    printf("    Cooldown (sec)  : %d\n", rule->cooldown);
    printf("    AffectedEntity  : %s\n", rule->affectedEntityJson ? rule->affectedEntityJson : "null");
}

void *reload_data_thread(void *args)
{
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK)
    {
        fprintf(stderr, "[ERROR] [Config Data] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    ReloadArgs *reload_args = (ReloadArgs *)args;

    while (1)
    {
        pthread_mutex_lock(&config_mutex);

        loadSignalRules(conn);

        pthread_mutex_unlock(&config_mutex);

        sleep(reload_args->interval_seconds);
    }

    return NULL;
}
