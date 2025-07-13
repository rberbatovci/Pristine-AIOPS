CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL UNIQUE,
    email VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_staff BOOLEAN DEFAULT FALSE
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
    features JSONB
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
    alert BOOLEAN DEFAULT FALSE;
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
    alert BOOLEAN DEFAULT FALSE;
);

-- Create table syslogTags
CREATE TABLE IF NOT EXISTS "trapTags" (
    name VARCHAR(50) PRIMARY KEY,
    oids TEXT[] DEFAULT '{}'
);


CREATE TABLE IF NOT EXISTS stateful_trap_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    opensignaltrap_id INTEGER,
    closesignaltrap_id INTEGER,
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
    CONSTRAINT fk_opensignaltrap
        FOREIGN KEY (opensignaltrap_id) REFERENCES snmp_trap_oids(id) ON DELETE SET NULL,
    CONSTRAINT fk_opensignaltrap
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