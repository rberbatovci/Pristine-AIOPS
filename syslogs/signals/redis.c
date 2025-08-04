#include <hiredis/hiredis.h>
#include <jansson.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include "globals.h"

redisContext *redis_ctx = NULL;

int on_startup_redis(const char *host, int port) {
    redis_ctx = redisConnect(host, port);
    if (!redis_ctx || redis_ctx->err) {
        if (redis_ctx) {
            fprintf(stderr, "[REDIS ERROR] %s\n", redis_ctx->errstr);
            redisFree(redis_ctx);
        } else {
            fprintf(stderr, "[REDIS ERROR] Failed to allocate Redis context\n");
        }
        return -1;
    }

    if (load_active_signals_from_redis(redis_ctx) < 0) {
        fprintf(stderr, "[REDIS ERROR] Failed to load active signals\n");
        return -1;
    }

    return 0;
}

int load_active_signals_from_redis(redisContext *c) {
    redisReply *reply = redisCommand(c, "SMEMBERS active_signals");
    if (!reply || reply->type != REDIS_REPLY_ARRAY) {
        fprintf(stderr, "[REDIS ERROR] Failed to retrieve active_signals set\n");
        if (reply) freeReplyObject(reply);
        return -1;
    }

    active_signal_count = 0;  // Make sure to initialize count before loading

    for (size_t i = 0; i < reply->elements && active_signal_count < MAX_ACTIVE_SIGNALS; ++i) {
        const char *signal_id = reply->element[i]->str;
        redisReply *data = redisCommand(c, "GET signals:syslogs:%s", signal_id);
        if (!data || data->type != REDIS_REPLY_STRING) {
            if (data) freeReplyObject(data);
            continue;
        }

        json_error_t error;
        json_t *json = json_loads(data->str, 0, &error);
        freeReplyObject(data);
        if (!json) continue;

        ActiveSignal *sig = &active_signals[active_signal_count++];
        memset(sig, 0, sizeof(ActiveSignal));

        strncpy(sig->signalId, json_string_value(json_object_get(json, "signalId")), sizeof(sig->signalId));
        strncpy(sig->device, json_string_value(json_object_get(json, "device")), sizeof(sig->device));
        strncpy(sig->rule, json_string_value(json_object_get(json, "rule")), sizeof(sig->rule));
        strncpy(sig->severity, json_string_value(json_object_get(json, "severity")), sizeof(sig->severity));
        strncpy(sig->status, json_string_value(json_object_get(json, "status")), sizeof(sig->status));
        strncpy(sig->startTime, json_string_value(json_object_get(json, "startTime")), sizeof(sig->startTime));
        strncpy(sig->endTime, json_string_value(json_object_get(json, "endTime")), sizeof(sig->endTime));

        sig->status_changed_at = json_integer_value(json_object_get(json, "status_changed_at"));
        sig->affectedEntities = json_incref(json_object_get(json, "affectedEntities"));

        json_decref(json);
    }

    fprintf(stdout, "[INFO] Loaded %d active signals from Redis\n", active_signal_count);

    freeReplyObject(reply);
    return 0;
}

int store_signal_in_redis(redisContext *ctx, const ActiveSignal *signal) {
    if (!ctx || ctx->err) return 0;

    char redis_key[128];
    snprintf(redis_key, sizeof(redis_key), "signals:syslogs:%s", signal->signalId);

    json_t *json = json_object();
    json_object_set_new(json, "signalId", json_string(signal->signalId));
    json_object_set_new(json, "device", json_string(signal->device));
    json_object_set_new(json, "rule", json_string(signal->rule));
    json_object_set_new(json, "severity", json_string(signal->severity));
    json_object_set_new(json, "status", json_string(signal->status));
    json_object_set_new(json, "startTime", json_string(signal->startTime));
    json_object_set_new(json, "endTime", json_string(signal->endTime));
    json_object_set_new(json, "status_changed_at", json_integer(signal->status_changed_at));
    json_object_set(json, "affectedEntities", signal->affectedEntities);

    char *json_str = json_dumps(json, JSON_COMPACT);

    // Store to Redis key
    redisReply *reply = redisCommand(ctx, "SET %s %s", redis_key, json_str);
    if (!reply) {
        fprintf(stderr, "[REDIS ERROR] Failed to store signal %s\n", signal->signalId);
        free(json_str);
        json_decref(json);
        return 0;
    }
    freeReplyObject(reply);

    // Add signal ID to active_signals set
    reply = redisCommand(ctx, "SADD active_signals %s", signal->signalId);
    if (!reply) {
        fprintf(stderr, "[REDIS ERROR] Failed to add signal %s to active_signals set\n", signal->signalId);
        free(json_str);
        json_decref(json);
        return 0;
    }
    freeReplyObject(reply);

    free(json_str);
    json_decref(json);
    return 1;
}

void delete_signal_from_redis(const char *signalId) {
    if (!redis_ctx) return;

    char redis_key[128];
    snprintf(redis_key, sizeof(redis_key), "signals:syslogs:%s", signalId);

    // Delete signal key
    redisReply *reply = redisCommand(redis_ctx, "DEL %s", redis_key);
    if (!reply) {
        fprintf(stderr, "[REDIS] Failed to delete signal %s from Redis.\n", signalId);
        return;
    }
    if (reply->type == REDIS_REPLY_INTEGER && reply->integer == 1) {
        printf("[REDIS] Deleted signal %s from Redis.\n", signalId);
    } else {
        printf("[REDIS] No signal found for %s to delete.\n", signalId);
    }
    freeReplyObject(reply);

    // Remove signal ID from active_signals set
    reply = redisCommand(redis_ctx, "SREM active_signals %s", signalId);
    if (!reply) {
        fprintf(stderr, "[REDIS] Failed to remove signal %s from active_signals set.\n", signalId);
        return;
    }
    freeReplyObject(reply);
}