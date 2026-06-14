CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    keycloak_user_id VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255),
    email VARCHAR(255),
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR NOT NULL UNIQUE,
    ip_address VARCHAR NOT NULL UNIQUE,
    status BOOLEAN,
    vendor VARCHAR,
    type VARCHAR,
    version VARCHAR,
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    features JSONB DEFAULT $${
        "syslogs": false,
        "snmp_traps": false,
        "netflow": false,
        "telemetry": {
            "enabled": false,
            "features": {
                "system_util": false,
                "rib_table": false,
                "fib_entry": false,
                "interface_stats": false,
                "bgp_connections": false,
                "isis_stats": false,
                "ospf_stats": false,
                "lldp_stats": false
            }
        },
        "topology": false,
        "authentication": false
    }$$::jsonb
);

-- Create table syslogTags
CREATE TABLE IF NOT EXISTS "syslogTags" (
    name VARCHAR(50) PRIMARY KEY
);

-- Create table regex
CREATE TABLE IF NOT EXISTS regex (
    id SERIAL PRIMARY KEY,
    name VARCHAR(25) UNIQUE NOT NULL,
    pattern VARCHAR(255),
    matchfunction VARCHAR(25) NOT NULL DEFAULT 'search',
    matchnumber INTEGER DEFAULT NULL,
    groupnumber INTEGER DEFAULT NULL,
    nomatch VARCHAR(25) DEFAULT '',
    tag VARCHAR(50),
    CONSTRAINT fk_tag FOREIGN KEY(tag) REFERENCES "syslogTags"(name)
);

-- Create table mnemonics
CREATE TABLE IF NOT EXISTS mnemonics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    severity VARCHAR(15) DEFAULT NULL,
    level INTEGER DEFAULT NULL,
    alert BOOLEAN DEFAULT FALSE
);

-- Create association table mnemonic_regex for many-to-many relationship
CREATE TABLE IF NOT EXISTS mnemonic_regex (
    mnemonic_id INTEGER NOT NULL,
    regex_id INTEGER NOT NULL,
    PRIMARY KEY (mnemonic_id, regex_id),
    FOREIGN KEY (mnemonic_id) REFERENCES mnemonics(id) ON DELETE CASCADE,
    FOREIGN KEY (regex_id) REFERENCES regex(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stateful_syslog_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    opensignalmnemonic_id INTEGER,
    closesignalmnemonic_id INTEGER,
    opensignaltag VARCHAR(255) NOT NULL,
    opensignalvalue VARCHAR(255) NOT NULL,
    closesignaltag VARCHAR(255) NOT NULL,
    closesignalvalue VARCHAR(255) NOT NULL,
    initialseverity VARCHAR(255) NOT NULL,
    affectedentity JSON DEFAULT '[]',
    description TEXT NOT NULL,
    warmup INTEGER NOT NULL,
    cooldown INTEGER NOT NULL,

    -- Foreign key constraints
    CONSTRAINT fk_opensignalmnemonic
        FOREIGN KEY (opensignalmnemonic_id) REFERENCES mnemonics(id) ON DELETE SET NULL,
    CONSTRAINT fk_closesignalmnemonic
        FOREIGN KEY (closesignalmnemonic_id) REFERENCES mnemonics(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stateful_syslog_rule_devices (
    stateful_syslog_rule_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    PRIMARY KEY (stateful_syslog_rule_id, device_id),
    FOREIGN KEY (stateful_syslog_rule_id) REFERENCES stateful_syslog_rules (id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);

-- ✅ New association table for mnemonics and stateful_syslog_rules
CREATE TABLE IF NOT EXISTS mnemonic_rules (
    mnemonic_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    PRIMARY KEY (mnemonic_id, rule_id),
    FOREIGN KEY (mnemonic_id) REFERENCES mnemonics(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES stateful_syslog_rules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS syslogsignalseverity (
    id SERIAL PRIMARY KEY,
    number INTEGER NOT NULL,
    severity VARCHAR(15) NOT NULL,
    description VARCHAR(255) NOT NULL
);

INSERT INTO syslogsignalseverity (id, number, severity, description)
VALUES (1, 3, 'Error', 'We detected a potential signal of compromise in your system!');

CREATE TABLE IF NOT EXISTS snmp_trap_oids (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    value VARCHAR(255) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    alert BOOLEAN DEFAULT FALSE
);

-- Create table syslogTags
CREATE TABLE IF NOT EXISTS "trapTags" (
    name VARCHAR(50) PRIMARY KEY,
    oids TEXT[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS trap_oid_tags (
    trap_oid_id INTEGER NOT NULL,
    tag_name VARCHAR NOT NULL,
    PRIMARY KEY (trap_oid_id, tag_name),
    FOREIGN KEY (trap_oid_id) REFERENCES snmp_trap_oids(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_name) REFERENCES "trapTags"(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stateful_trap_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    opensignaltrap_id INTEGER,
    closesignaltrap_id INTEGER,
    opensignaltag VARCHAR(255), 
    opensignalvalue VARCHAR(255),
    closesignaltag VARCHAR(255),
    closesignalvalue VARCHAR(255),
    initialseverity VARCHAR(255),
    affectedentity JSON DEFAULT '[]',
    description TEXT NOT NULL,
    warmup INTEGER NOT NULL,
    cooldown INTEGER NOT NULL,

    CONSTRAINT fk_opensignaltrap
        FOREIGN KEY (opensignaltrap_id) REFERENCES snmp_trap_oids(id) ON DELETE SET NULL,
    CONSTRAINT fk_closesignaltrap
        FOREIGN KEY (closesignaltrap_id) REFERENCES snmp_trap_oids(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stateful_trap_rule_devices (
    stateful_trap_rule_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    PRIMARY KEY (stateful_trap_rule_id, device_id),
    FOREIGN KEY (stateful_trap_rule_id) REFERENCES stateful_trap_rules (id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);

-- ✅ New association table for mnemonics and stateful_syslog_rules
CREATE TABLE IF NOT EXISTS trap_rules (
    trap_id INTEGER NOT NULL,
    rule_id INTEGER NOT NULL,
    PRIMARY KEY (trap_id, rule_id),
    FOREIGN KEY (trap_id) REFERENCES snmp_trap_oids(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES stateful_trap_rules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS telemetry_signals_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    highthreshold DOUBLE PRECISION,
    lowthreshold DOUBLE PRECISION,
    openvalue VARCHAR(255),
    closevalue VARCHAR(255),
    initialseverity VARCHAR(255) NOT NULL,
    affectedentity JSON DEFAULT '[]',
    description TEXT NOT NULL,
    warmup INTEGER NOT NULL,
    cooldown INTEGER NOT NULL
);

INSERT INTO telemetry_signals_rules (
    name,
    highthreshold,
    lowthreshold,
    openvalue,
    closevalue,
    initialseverity,
    affectedentity,
    description,
    warmup,
    cooldown
)
VALUES (
    'cpu-utilization',
    90,
    20,
    'ALERT_OPEN',
    'ALERT_CLOSE',
    'Warning',
    '[]',
    'CPU utilization monitoring rule',
    30,
    60
)
ON CONFLICT (name) DO NOTHING;

-- Create the function
CREATE OR REPLACE FUNCTION update_mnemonics_alert()
RETURNS trigger AS $$
BEGIN
    -- Update mnemonics.alert based on severity level and rules
    UPDATE mnemonics m
    SET alert = (
        EXISTS (
            SELECT 1
            FROM syslogsignalseverity s
            WHERE s.number <= COALESCE(m.level, 100000)
        )
        OR EXISTS (
            SELECT 1
            FROM stateful_syslog_rules r
            WHERE r.opensignalmnemonic_id = m.id OR r.closesignalmnemonic_id = m.id
        )
    );

    RETURN NULL;  -- Required for statement-level trigger
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_snmpTrapOid_alert()
RETURNS trigger AS $$
BEGIN
    UPDATE snmp_trap_oids m
    SET alert = (
        EXISTS (
            SELECT 1
            FROM stateful_trap_rules r
            WHERE r.opensignaltrap_id = m.id OR r.closesignaltrap_id = m.id
        )
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the triggers
CREATE TRIGGER trg_update_snmpTrapOid_on_rules
AFTER INSERT OR UPDATE OR DELETE ON stateful_trap_rules
FOR EACH STATEMENT
EXECUTE FUNCTION update_snmpTrapOid_alert();

-- Create the triggers
CREATE TRIGGER trg_update_mnemonic_on_severity
AFTER INSERT OR UPDATE OR DELETE ON syslogsignalseverity
FOR EACH STATEMENT
EXECUTE FUNCTION update_mnemonics_alert();

CREATE TRIGGER trg_update_alert_on_rules
AFTER INSERT OR UPDATE OR DELETE ON stateful_syslog_rules
FOR EACH STATEMENT
EXECUTE FUNCTION update_mnemonics_alert();