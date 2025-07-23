
#ifndef NETFLOW_PARSER_H
#define NETFLOW_PARSER_H

#include <stdint.h>


typedef struct {
    uint16_t version;       
    uint16_t count;          
    uint32_t sysUptime;      
    uint32_t unix_secs;      
    uint32_t unix_nsecs;     
    uint32_t flow_sequence;  
    uint32_t source_id;
} NetFlowV9Header;

typedef struct {
    uint16_t version;
    uint16_t length;
    uint32_t export_time;
    uint32_t sequence_number;
    uint32_t observation_id;
} IPFIXHeader;

typedef struct {
    uint32_t source_addr;
    uint32_t dest_addr;
    uint8_t protocol;
    uint16_t source_port;
    uint16_t dest_port;
    uint32_t input_snmp;
    uint32_t output_snmp;
    uint32_t bytes_count;
    uint32_t packets_count;
    uint64_t first_timestamp;
    uint64_t last_timestamp;
} FlowRecord;

typedef struct {
    uint16_t version;        // 9 or 10
    union {
        NetFlowV9Header v9;
        IPFIXHeader v10;
    } header;
    FlowRecord *records;
    size_t record_count;
} NetFlowPacket;