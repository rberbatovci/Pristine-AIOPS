#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <stddef.h>
#include <regex.h>
#include <ctype.h>
#include "globals.h"
#define _XOPEN_SOURCE
#include <time.h>

#define MAX_MATCHES 3

const char *severity_levels[] = {
    "Emergency", "Alert", "Critical", "Error",
    "Warning", "Notice", "Informational", "Debugging"
};

char *trim_whitespace(char *str) {
    while (isspace((unsigned char)*str)) str++;  // Leading space
    if (*str == 0) return str; // All spaces

    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;  // Trailing space
    end[1] = '\0';

    return str;
}

int get_mnemonic_regexes(const char *name, Regex **out, int max_count) {
    int count = 0;
    for (int i = 0; i < regex_count && count < max_count; i++) {
        if (strcasecmp(regexes[i].name, name) == 0) {
            out[count++] = &regexes[i];
        }
    }
    return count;
}

bool extract_severity(const char *mnemonic, char *severity_name_out, size_t severity_name_size, int *severity_level_out) {
    regex_t regex_severity;
    regmatch_t matches[MAX_MATCHES];

    *severity_level_out = -1;
    severity_name_out[0] = '\0';

    if (regcomp(&regex_severity, "-([0-7])-", REG_EXTENDED) != 0) {
        fprintf(stderr, "[ERROR] Failed to compile severity regex\n");
        return false;
    }

    bool found = false;
    if (regexec(&regex_severity, mnemonic, MAX_MATCHES, matches, 0) == 0) {
        char sev_char = mnemonic[matches[1].rm_so];
        int sev = sev_char - '0';
        *severity_level_out = sev;
        snprintf(severity_name_out, severity_name_size, "%s", severity_levels[sev]);
        //printf("[DEBUG] Extracted severity: %s (%d)\n", severity_name_out, sev);
        found = true;
    } else {
        ///printf("[DEBUG] Severity not found in mnemonic.\n");
    }

    regfree(&regex_severity);
    return found;
}

bool extract_mnemonic(const char *message, char *mnemonic_out, size_t mnemonic_size) {
    regex_t regex_mnemonic;
    regmatch_t matches[MAX_MATCHES];
    mnemonic_out[0] = '\0';

    if (regcomp(&regex_mnemonic, "%([^:]+)\\s*:", REG_EXTENDED) != 0) {
        fprintf(stderr, "[ERROR] Failed to compile mnemonic regex\n");
        return false;
    }

    bool found = false;
    if (regexec(&regex_mnemonic, message, MAX_MATCHES, matches, 0) == 0) {
        size_t len = matches[1].rm_eo - matches[1].rm_so;
        if (len >= mnemonic_size) len = mnemonic_size - 1;
        strncpy(mnemonic_out, message + matches[1].rm_so, len);
        mnemonic_out[len] = '\0';
        //printf("[DEBUG] Extracted mnemonic: %s\n", mnemonic_out);
        found = true;
    } else {
        printf("[DEBUG] No mnemonic pattern found in message.\n");
    }

    regfree(&regex_mnemonic);
    return found;
}

void extract_timestamp(const char *message, char *timestamp_out, size_t timestamp_size) {
    regex_t regex_timestamp;
    regmatch_t match[2];

    // Match: *Jul 28 12:58:55.816:
    const char *pattern = "\\*([A-Z][a-z]{2}\\s+[0-9]{1,2}\\s+[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}):";

    timestamp_out[0] = '\0';

    if (regcomp(&regex_timestamp, pattern, REG_EXTENDED) != 0) {
        fprintf(stderr, "[ERROR] Failed to compile timestamp regex\n");
        return;
    }

    if (regexec(&regex_timestamp, message, 2, match, 0) == 0) {
        size_t len = match[1].rm_eo - match[1].rm_so;
        char raw_timestamp[64] = {0};
        if (len >= sizeof(raw_timestamp)) len = sizeof(raw_timestamp) - 1;
        strncpy(raw_timestamp, message + match[1].rm_so, len);
        raw_timestamp[len] = '\0';

        // Parse the extracted timestamp
        struct tm tm_time = {0};
        char millis[4] = "000";

        // Separate date and milliseconds
        char date_part[32] = {0};
        sscanf(raw_timestamp, "%[A-Za-z0-9: ]", date_part); // Excludes the '.' and millis
        char *ms_ptr = strstr(raw_timestamp, ".");
        if (ms_ptr) {
            strncpy(millis, ms_ptr + 1, 3);
            millis[3] = '\0';
        }

        // Parse into struct tm
        if (strptime(date_part, "%b %d %H:%M:%S", &tm_time) == NULL) {
            fprintf(stderr, "[ERROR] Failed to parse date part: %s\n", date_part);
            regfree(&regex_timestamp);
            return;
        }

        // Add current year
        time_t now = time(NULL);
        struct tm *now_tm = localtime(&now);
        tm_time.tm_year = now_tm->tm_year;

        // Format as ISO 8601
        char iso_part[40];
        strftime(iso_part, sizeof(iso_part), "%Y-%m-%dT%H:%M:%S", &tm_time);
        snprintf(timestamp_out, timestamp_size, "%s.%sZ", iso_part, millis);

        //printf("[DEBUG] Extracted ISO timestamp: %s\n", timestamp_out);
    } else {
        printf("[DEBUG] No timestamp found in message.\n");
    }

    regfree(&regex_timestamp);
}

int extract_lsn(const char *original_message) {
    regex_t regex;
    regmatch_t matches[2]; // Whole match + capture group
    const char *pattern = "^<[0-9]+>([0-9]+):";

    if (regcomp(&regex, pattern, REG_EXTENDED)) {
        fprintf(stderr, "[ERROR] Could not compile regex\n");
        return -1;
    }

    int ret = regexec(&regex, original_message, 2, matches, 0);
    if (ret == 0) {
        int start = matches[1].rm_so;
        int end = matches[1].rm_eo;
        char lsn_str[16] = {0};

        if ((size_t)(end - start) < sizeof(lsn_str)) {
            strncpy(lsn_str, original_message + start, end - start);
            lsn_str[end - start] = '\0';
            regfree(&regex);
            return atoi(lsn_str);
        }
    } else if (ret == REG_NOMATCH) {
        //printf("[WARN] No LSN match found\n");
    } else {
        char errbuf[100];
        regerror(ret, &regex, errbuf, sizeof(errbuf));
        //fprintf(stderr, "[ERROR] Regex error: %s\n", errbuf);
    }

    regfree(&regex);
    return -1;
}

char *extract_tags(const Regex *r, const char *message) {
    regex_t regex;
    regmatch_t pmatch[10];  // supports up to 10 groups
    int reti;

    if (!r || !r->pattern || !message) return NULL;

    // Compile the regex
    reti = regcomp(&regex, r->pattern, REG_EXTENDED);
    if (reti) {
        //fprintf(stderr, "[ERROR] Failed to compile regex pattern: %s\n", r->pattern);
        return NULL;
    }

    // Execute regex match
    reti = regexec(&regex, message, 10, pmatch, 0);
    if (!reti) {
        int group = r->groupnumber;
        if (group < 1 || group >= 10 || pmatch[group].rm_so == -1) {
            regfree(&regex);
            return strdup("NoMatch");
        }

        int start = pmatch[group].rm_so;
        int end = pmatch[group].rm_eo;
        int len = end - start;

        char *match_str = (char *)malloc(len + 1);
        if (!match_str) {
            regfree(&regex);
            return NULL;
        }
        strncpy(match_str, message + start, len);
        match_str[len] = '\0';

        regfree(&regex);
        return match_str;
    } else {
        regfree(&regex);
        return strdup("NoMatch");
    }
}