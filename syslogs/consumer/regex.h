#ifndef REGEX_H
#define REGEX_H

#include <stdbool.h>
#include <stddef.h>
#include "config.h"  // for Regex struct

bool extract_severity(const char *mnemonic, char *severity_name_out, size_t severity_name_size, int *severity_level_out);

bool extract_mnemonic(const char *message, char *mnemonic_out, size_t mnemonic_size);

void extract_timestamp(const char *message, char *timestamp_out, size_t timestamp_size);

int extract_lsn(const char *original_message);

char *extract_tags(const Regex *r, const char *message);

Regex* get_mnemonic_regexes(const char *name);

#endif // REGEX_DATA_H
