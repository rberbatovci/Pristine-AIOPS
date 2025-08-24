#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <signal.h>
#include <unistd.h>
#include <time.h>
#include <hiredis/hiredis.h>
#include "globals.h"
// Global Redis context
static redisContext *redis_ctx = NULL;

extern volatile sig_atomic_t run;

/**
 * Connect to Redis
 */
int connect_redis(const char *hostname, int port) {
    struct timeval timeout = {1, 500000}; // 1.5 seconds
    redis_ctx = redisConnectWithTimeout(hostname, port, timeout);
    if (redis_ctx == NULL || redis_ctx->err) {
        if (redis_ctx) {
            fprintf(stderr, "Redis connection error: %s\n", redis_ctx->errstr);
            redisFree(redis_ctx);
            redis_ctx = NULL;
        } else {
            fprintf(stderr, "Redis connection error: can't allocate redis context\n");
        }
        return -1;
    }
    return 0;
}

/**
 * Disconnect Redis
 */
void disconnect_redis() {
    if (redis_ctx) {
        redisFree(redis_ctx);
        redis_ctx = NULL;
    }
}

/**
 * Load Regexes from Redis into global cache
 */
int load_regexes_from_redis() {
    if (!redis_ctx) return -1;

    redisReply *reply = redisCommand(redis_ctx, "SMEMBERS syslogs:regex");
    if (!reply) return -1;

    if (reply->type == REDIS_REPLY_ARRAY) {
        regex_cache_size = reply->elements;
        regex_cache = calloc(regex_cache_size, sizeof(Regex));

        for (size_t i = 0; i < reply->elements; i++) {
            char *regex_key = reply->element[i]->str;

            redisReply *regex_reply = redisCommand(redis_ctx, "HGETALL %s", regex_key);
            if (regex_reply && regex_reply->type == REDIS_REPLY_ARRAY) {
                for (size_t j = 0; j < regex_reply->elements; j += 2) {
                    char *field = regex_reply->element[j]->str;
                    char *value = regex_reply->element[j+1]->str;

                    if (strcmp(field, "name") == 0)
                        regex_cache[i].name = strdup(value);
                    else if (strcmp(field, "pattern") == 0)
                        regex_cache[i].pattern = strdup(value);
                    else if (strcmp(field, "matchfunction") == 0)
                        regex_cache[i].matchfunction = strdup(value);
                    else if (strcmp(field, "matchnumber") == 0)
                        regex_cache[i].matchnumber = atoi(value);
                    else if (strcmp(field, "groupnumber") == 0)
                        regex_cache[i].groupnumber = atoi(value);
                    else if (strcmp(field, "nomatch") == 0)
                        regex_cache[i].nomatch = strdup(value);
                    else if (strcmp(field, "tag") == 0)
                        regex_cache[i].tag = strdup(value);
                }
            }
            if (regex_reply) freeReplyObject(regex_reply);
        }
    }

    freeReplyObject(reply);
    return 0;
}

/**
 * Load Mnemonics from Redis into global cache
 */
int load_mnemonics_from_redis() {
    if (!redis_ctx) return -1;

    redisReply *reply = redisCommand(redis_ctx, "SMEMBERS syslogs:mnemonics");
    if (!reply) return -1;

    if (reply->type == REDIS_REPLY_ARRAY) {
        mnemonic_cache_size = reply->elements;
        mnemonic_cache = calloc(mnemonic_cache_size, sizeof(MnemonicCache));

        for (size_t i = 0; i < reply->elements; i++) {
            char *mnemonic_key = reply->element[i]->str;

            redisReply *mnemonic_reply = redisCommand(redis_ctx, "HGETALL %s", mnemonic_key);
            if (mnemonic_reply && mnemonic_reply->type == REDIS_REPLY_ARRAY) {
                mnemonic_cache[i].mnemonic = strdup(mnemonic_key);

                for (size_t j = 0; j < mnemonic_reply->elements; j += 2) {
                    char *field = mnemonic_reply->element[j]->str;
                    char *value = mnemonic_reply->element[j+1]->str;

                    if (strcmp(field, "severity") == 0)
                        mnemonic_cache[i].info.severity = strdup(value);
                    else if (strcmp(field, "alert") == 0)
                        mnemonic_cache[i].info.alert = (strcmp(value, "true") == 0);
                    else if (strcmp(field, "level") == 0)
                        mnemonic_cache[i].info.level = atoi(value);
                }
            }
            if (mnemonic_reply) freeReplyObject(mnemonic_reply);
        }
    }

    freeReplyObject(reply);
    return 0;
}

/**
 * Create Mnemonic on Redis
 */
int create_mnemonic_on_redis(const char *mnemonic, MnemonicInfo *info) {
    if (!redis_ctx) return -1;

    redisReply *reply = redisCommand(redis_ctx, "SADD syslogs:mnemonics %s", mnemonic);
    if (reply) freeReplyObject(reply);

    reply = redisCommand(redis_ctx,
                         "HMSET %s severity %s alert %s level %d",
                         mnemonic,
                         info->severity ? info->severity : "",
                         info->alert ? "true" : "false",
                         info->level);
    if (reply) freeReplyObject(reply);

    return 0;
}

/**
 * Free Regex Cache
 */
void free_regex_cache() {
    for (size_t i = 0; i < regex_cache_size; i++) {
        free(regex_cache[i].name);
        free(regex_cache[i].pattern);
        free(regex_cache[i].matchfunction);
        free(regex_cache[i].nomatch);
        free(regex_cache[i].tag);
    }
    free(regex_cache);
    regex_cache = NULL;
    regex_cache_size = 0;
}

/**
 * Free Mnemonic Cache
 */
void free_mnemonic_cache() {
    for (size_t i = 0; i < mnemonic_cache_size; i++) {
        free(mnemonic_cache[i].mnemonic);
        free(mnemonic_cache[i].info.severity);
        for (int j = 0; j < mnemonic_cache[i].info.regex_count; j++) {
            free(mnemonic_cache[i].info.regexes[j]);
        }
        free(mnemonic_cache[i].info.regexes);
    }
    free(mnemonic_cache);
    mnemonic_cache = NULL;
    mnemonic_cache_size = 0;
}

/**
 * Reload data from Redis in a separate thread
 */
void *reload_data_thread(void *arg) {
    ReloadArgs *args = (ReloadArgs *)arg;

    while (run) {
        sleep(args->interval_seconds);

        if (!run) break;

        printf("[INFO] Reloading regexes and mnemonics from Redis...\n");

        // Free old cache to avoid leaks
        free_regex_cache();
        free_mnemonic_cache();

        // Reload from Redis
        if (connect_redis("127.0.0.1", 6379) == 0) {
            load_regexes_from_redis();
            load_mnemonics_from_redis();
            disconnect_redis();
            printf("[INFO] Reload completed successfully.\n");
        } else {
            fprintf(stderr, "[ERROR] Failed to reconnect to Redis for reload.\n");
        }
    }

    printf("[INFO] Reload thread exiting...\n");
    return NULL;
}