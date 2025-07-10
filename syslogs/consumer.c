#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <regex.h>
#include <librdkafka/rdkafka.h>
#include <jansson.h>
#include <libpq-fe.h>
#include <ctype.h>

#define MAX_MATCHES 3

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
    char *action;
    char *level;
    char **regexes;
    int regex_count;
} MnemonicInfo;

typedef struct {
    char *mnemonic;
    MnemonicInfo info;
} MnemonicCache;

Regex *regexes = NULL;
int regex_count = 0;

MnemonicCache *cache = NULL;
int cache_size = 0;

char *trim_whitespace(char *str) {
    while (isspace((unsigned char)*str)) str++;  // Leading space
    if (*str == 0) return str; // All spaces

    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;  // Trailing space
    end[1] = '\0';

    return str;
}

Regex *find_regex_by_name(const char *name) {
    char trimmed_name[128];
    strncpy(trimmed_name, name, sizeof(trimmed_name));
    trimmed_name[sizeof(trimmed_name)-1] = '\0';
    char *clean_name = trim_whitespace(trimmed_name);

    for (int i = 0; i < regex_count; i++) {
        if (strcasecmp(regexes[i].name, clean_name) == 0) {
            return &regexes[i];
        }
    }
    fprintf(stderr, "[WARN] Regex not found in cache: '%s'\n", clean_name);
    return NULL;
}

const char *severity_levels[] = {
    "Emergency", "Alert", "Critical", "Error",
    "Warning", "Notice", "Informational", "Debugging"
};

void load_mnemonics_from_postgres() {
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return;
    }

    PGresult *res = PQexec(conn,
        "SELECT "
        "  m.name, "
        "  m.severity, "
        "  m.level, "
        "  CASE "
        "    WHEN EXISTS ( "
        "      SELECT 1 FROM stateful_syslog_rules r "
        "      WHERE r.opensignalmnemonic_id = m.id OR r.closesignalmnemonic_id = m.id "
        "    ) THEN 'pass' "
        "    ELSE 'drop' "
        "  END AS action, "
        "  ARRAY( "
        "    SELECT regex.name "
        "    FROM mnemonic_regex mr "
        "    JOIN regex ON regex.id = mr.regex_id "
        "    WHERE mr.mnemonic_id = m.id "
        "  ) AS regexes "
        "FROM mnemonics m");

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] Failed to fetch mnemonics: %s\n", PQerrorMessage(conn));
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
        cache[i].info.level = strdup(level_str);

        cache[i].info.action = strdup(PQgetvalue(res, row, 3));

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
    PQfinish(conn);

    printf("[INFO] Loaded %d mnemonics from PostgreSQL into cache\n", cache_size);
}

void load_regexes_from_psql() {
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        exit(1);
    }

    PGresult *res = PQexec(conn, "SELECT name, pattern, matchfunction, matchnumber, groupnumber, nomatch, tag FROM regex");

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "Failed to fetch regexes: %s\n", PQerrorMessage(conn));
        PQclear(res);
        return;
    }

    regex_count = PQntuples(res);
    regexes = malloc(sizeof(Regex) * regex_count);
    if (!regexes) {
        fprintf(stderr, "Failed to allocate memory for regex cache\n");
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
    printf("Loaded %d regexes from PostgreSQL\n", regex_count);
}

MnemonicInfo *get_mnemonic_from_cache(const char *mnemonic) {
    for (int i = 0; i < cache_size; i++) {
        if (strcmp(cache[i].mnemonic, mnemonic) == 0) {
            return &cache[i].info;
        }
    }
    return NULL; // Not found
}

MnemonicInfo *fetch_mnemonic_from_db(const char *mnemonic) {
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    const char *paramValues[1] = { mnemonic };
    PGresult *res = PQexecParams(conn,
        "SELECT "
        "  m.name, "
        "  m.severity, "
        "  m.level, "
        "  CASE "
        "    WHEN EXISTS ( "
        "      SELECT 1 FROM stateful_syslog_rules r "
        "      WHERE r.opensignalmnemonic_id = m.id OR r.closesignalmnemonic_id = m.id "
        "    ) THEN 'pass' "
        "    ELSE 'drop' "
        "  END AS action, "
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

    // Expand cache
    cache = realloc(cache, sizeof(MnemonicCache) * (cache_size + 1));
    int i = cache_size++;

    cache[i].mnemonic = strdup(PQgetvalue(res, 0, 0));
    cache[i].info.severity = strdup(PQgetvalue(res, 0, 1));

    char level_str[12];
    snprintf(level_str, sizeof(level_str), "%d", atoi(PQgetvalue(res, 0, 2)));
    cache[i].info.level = strdup(level_str);
    cache[i].info.action = strdup(PQgetvalue(res, 0, 3));

    // Parse regexes
    char *regex_array = PQgetvalue(res, 0, 4);
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

    PQclear(res);
    PQfinish(conn);

    return &cache[i].info;
}

MnemonicInfo *create_mnemonic_and_cache(const char *mnemonic) {
    const char *default_severity = "warning";
    int default_level = 1;
    
    const char *conninfo = "host=postgresql dbname=fpristine user=PristineAdmin password=PristinePassword";
    PGconn *conn = PQconnectdb(conninfo);

    if (PQstatus(conn) != CONNECTION_OK) {
        fprintf(stderr, "[ERROR] Connection to database failed: %s\n", PQerrorMessage(conn));
        PQfinish(conn);
        return NULL;
    }

    char level_str[12];
    snprintf(level_str, sizeof(level_str), "%d", default_level);
    const char *paramValues[3] = { mnemonic, default_severity, level_str };
    
    PGresult *res = PQexecParams(conn,
        "INSERT INTO mnemonics (name, severity, level) VALUES ($1, $2, $3) RETURNING id",
        3, NULL, paramValues, NULL, NULL, 0);

    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        fprintf(stderr, "[ERROR] Failed to insert mnemonic: %s\n", PQerrorMessage(conn));
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
    cache[i].info.severity = strdup(default_severity);
    cache[i].info.level = strdup("1");
    cache[i].info.action = strdup("drop");
    cache[i].info.regexes = NULL;
    cache[i].info.regex_count = 0;

    printf("[INFO] Created new mnemonic '%s' and cached\n", mnemonic);

    return &cache[i].info;
}

MnemonicInfo *get_or_create_mnemonic(const char *mnemonic) {
    MnemonicInfo *info = get_mnemonic_from_cache(mnemonic);
    if (info) return info;

    info = fetch_mnemonic_from_db(mnemonic);
    if (info) return info;

    return create_mnemonic_and_cache(mnemonic);
}

void extract_mnemonic(const char *message, char *mnemonic_out, size_t mnemonic_size,
                      char *severity_name_out, size_t severity_name_size, int *severity_level_out) {
    regex_t regex_mnemonic, regex_severity;
    regmatch_t matches[MAX_MATCHES];

    *severity_level_out = -1;
    mnemonic_out[0] = '\0';
    severity_name_out[0] = '\0';

    printf("[DEBUG] Extracting mnemonic from message: %s\n", message);

    // Match %...: pattern
    if (regcomp(&regex_mnemonic, "%([^:]+)\\s*:", REG_EXTENDED) != 0) {
        fprintf(stderr, "[ERROR] Failed to compile mnemonic regex\n");
        return;
    }

    if (regexec(&regex_mnemonic, message, MAX_MATCHES, matches, 0) == 0) {
        size_t len = matches[1].rm_eo - matches[1].rm_so;
        if (len >= mnemonic_size) len = mnemonic_size - 1;
        strncpy(mnemonic_out, message + matches[1].rm_so, len);
        mnemonic_out[len] = '\0';

        // Extract severity from mnemonic like -5-
        if (regcomp(&regex_severity, "-([0-9])-", REG_EXTENDED) == 0) {
            if (regexec(&regex_severity, mnemonic_out, MAX_MATCHES, matches, 0) == 0) {
                char sev_char = mnemonic_out[matches[1].rm_so];
                if (sev_char >= '0' && sev_char <= '7') {
                    int sev = sev_char - '0';
                    *severity_level_out = sev;
                    snprintf(severity_name_out, severity_name_size, "%s", severity_levels[sev]);
                }
            }
            regfree(&regex_severity);
        }
        printf("[DEBUG] Extracted mnemonic: %s\n", mnemonic_out);
        if (severity_name_out[0] != '\0') {
            printf("[DEBUG] Extracted severity: %s (%d)\n", severity_name_out, *severity_level_out);
        } else {
            printf("[DEBUG] Severity not found in mnemonic.\n");
        }
    } else {
        printf("[DEBUG] No mnemonic pattern found in message.\n");
    }

    regfree(&regex_mnemonic);
}

void extract_timestamp(const char *message, char *timestamp_out, size_t timestamp_size) {
    regex_t regex_timestamp;
    regmatch_t match[2];

    // Example timestamp format: *Jul 8 09:19:49.284:
    const char *pattern = "\\*([A-Z][a-z]{2}\\s+[0-9]{1,2}\\s+[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}):";

    timestamp_out[0] = '\0';

    printf("[DEBUG] Extracting timestamp from message: %s\n", message);

    if (regcomp(&regex_timestamp, pattern, REG_EXTENDED) != 0) {
        fprintf(stderr, "[ERROR] Failed to compile timestamp regex\n");
        return;
    }

    if (regexec(&regex_timestamp, message, 2, match, 0) == 0) {
        size_t len = match[1].rm_eo - match[1].rm_so;
        if (len >= timestamp_size) len = timestamp_size - 1;
        strncpy(timestamp_out, message + match[1].rm_so, len);
        timestamp_out[len] = '\0';

        printf("[DEBUG] Extracted timestamp: %s\n", timestamp_out);
    } else {
        printf("[DEBUG] No timestamp found in message.\n");
    }

    regfree(&regex_timestamp);
}

int extract_lsn(const char *message) {
    regex_t regex;
    regmatch_t matches[2];

    // Pattern: starts with <number> followed by another number and a colon
    const char *pattern = "^<\\d+>(\\d+):";

    printf("[DEBUG] Extracting LSN from message: %s\n", message);

    if (regcomp(&regex, pattern, REG_EXTENDED) != 0) {
        fprintf(stderr, "[ERROR] Failed to compile LSN regex\n");
        return -1;
    }

    int lsn = -1;
    if (regexec(&regex, message, 2, matches, 0) == 0) {
        size_t len = matches[1].rm_eo - matches[1].rm_so;
        char lsn_str[16];
        if (len >= sizeof(lsn_str)) len = sizeof(lsn_str) - 1;
        strncpy(lsn_str, message + matches[1].rm_so, len);
        lsn_str[len] = '\0';

        lsn = atoi(lsn_str);
        printf("[DEBUG] Extracted LSN: %d\n", lsn);
    } else {
        printf("[DEBUG] No LSN found in message.\n");
    }

    regfree(&regex);
    return lsn;
}

int main() {
    load_mnemonics_from_postgres();
    load_regexes_from_psql();
    const char *brokers = "Kafka:9092";
    const char *topic = "syslog-topic";

    char errstr[512];
    rd_kafka_t *rk;
    rd_kafka_conf_t *conf;
    rd_kafka_topic_partition_list_t *topics;

    conf = rd_kafka_conf_new();
    rd_kafka_conf_set(conf, "bootstrap.servers", brokers, errstr, sizeof(errstr));
    rd_kafka_conf_set(conf, "group.id", "syslog-consumer-group", errstr, sizeof(errstr));
    rd_kafka_conf_set(conf, "auto.offset.reset", "earliest", errstr, sizeof(errstr));

    rk = rd_kafka_new(RD_KAFKA_CONSUMER, conf, errstr, sizeof(errstr));
    if (!rk) {
        fprintf(stderr, "[ERROR] Failed to create consumer: %s\n", errstr);
        return 1;
    }

    rd_kafka_poll_set_consumer(rk);

    topics = rd_kafka_topic_partition_list_new(1);
    rd_kafka_topic_partition_list_add(topics, topic, -1);
    if (rd_kafka_subscribe(rk, topics)) {
        fprintf(stderr, "[ERROR] Failed to subscribe to topic %s\n", topic);
        return 1;
    }

    printf("[INFO] Subscribed to topic: %s\n", topic);

    while (1) {
        rd_kafka_message_t *rkmessage = rd_kafka_consumer_poll(rk, 1000);
        if (!rkmessage) {
            printf("[DEBUG] No message received in this poll cycle24\n");
            continue;
        }

        printf("[DEBUG] Message received from Kafka\n");

        if (rkmessage->err) {
            if (rkmessage->err == RD_KAFKA_RESP_ERR__PARTITION_EOF) {
                printf("[DEBUG] Partition EOF reached\n");
                rd_kafka_message_destroy(rkmessage);
                continue;
            } else {
                fprintf(stderr, "[ERROR] Kafka error: %s\n", rd_kafka_message_errstr(rkmessage));
                rd_kafka_message_destroy(rkmessage);
                continue;
            }
        }

        char *payload = malloc(rkmessage->len + 1);
        memcpy(payload, rkmessage->payload, rkmessage->len);
        payload[rkmessage->len] = '\0';

        printf("[DEBUG] Received Kafka message: %s\n", payload);

        // Parse JSON
        json_error_t json_error;
        json_t *root = json_loads(payload, 0, &json_error);
        if (!root) {
            fprintf(stderr, "[ERROR] Failed to parse JSON: %s\n", json_error.text);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        json_t *message_field = json_object_get(root, "message");
        if (!json_is_string(message_field)) {
            fprintf(stderr, "[ERROR] 'message' field missing or not a string.\n");
            json_decref(root);
            free(payload);
            rd_kafka_message_destroy(rkmessage);
            continue;
        }

        const char *message = json_string_value(message_field);
        printf("[DEBUG] Extracted syslog message: %s\n", message);

        int lsn = extract_lsn(message);

        char timestamp[128];
        extract_timestamp(message, timestamp, sizeof(timestamp));

        char mnemonic[256];
        char severity_name[64];
        int severity_level;

        extract_mnemonic(message, mnemonic, sizeof(mnemonic), severity_name, sizeof(severity_name), &severity_level);

        MnemonicInfo *info = get_or_create_mnemonic(mnemonic);
        if (info) {
            printf("[INFO] Mnemonic matched in cache2: %s\n", mnemonic);
            printf("        Severity: %s\n", info->severity);
            printf("        Action: %s\n", info->action);
            printf("        Regex count: %d\n", info->regex_count);
            printf("[DEBUG] About to print %d regexes for mnemonic %s\n", info->regex_count, mnemonic);
            for (int i = 0; i < info->regex_count; i++) {
                const char *regex_name = info->regexes[i];
                printf("[INFO] Trying to find metadata for: %s\n", regex_name);
                Regex *r = find_regex_by_name(regex_name);
                if (r) {
                    printf("        Regex[%d]: %s\n", i, regex_name);
                    printf("            Pattern: %s\n", r->pattern);
                    printf("            Match Function: %s\n", r->matchfunction);
                    printf("            Match Number: %d\n", r->matchnumber);
                    printf("            Group Number: %d\n", r->groupnumber);
                    printf("            No Match: %s\n", r->nomatch ? r->nomatch : "(none)");
                    printf("            Tag: %s\n", r->tag ? r->tag : "(none)");
                } else {
                    printf("        Regex[%d]: %s (metadata not found)\n", i, regex_name);
                }
            }
        }

        json_decref(root);
        free(payload);
        rd_kafka_message_destroy(rkmessage);
    }

    rd_kafka_topic_partition_list_destroy(topics);
    rd_kafka_consumer_close(rk);
    rd_kafka_destroy(rk);

    return 0;
}
