import React, { useState, useEffect, useMemo } from 'react';
import '../../css/SyslogTagsList.css';

import { useSyslogTags } from '../../hooks/useSyslogTags';
import { useSnmpTrapTags } from '../../hooks/useSnmpTrapTags';

const StatisticTags = ({ dataSource, source, selTags, setSelTags, keycloak }) => {
  const [searchValue, setSearchValue] = useState('');

  // --------------------------------------------------
  // Defaults
  // --------------------------------------------------
  const getDefaultTags = () => {
    if (source === 'events') {
      if (dataSource === 'syslogs') {
        return ['device', 'mnemonic', 'severity'];
      }
      return ['device', 'rules', 'severity', 'enterprise', 'specific_trap'];
    }

    // signals
    if (dataSource === 'syslogs') {
      return ['device', 'mnemonic', 'rule', 'severity'];
    }
    return ['device', 'oid', 'agent_address', 'trap_type'];
  };

  const defaultSelectedTags = () => {
    if (source === 'events') {
      return dataSource === 'syslogs'
        ? ['device', 'mnemonic', 'severity']
        : ['device', 'rules', 'severity'];
    }

    return dataSource === 'syslogs'
      ? ['device', 'mnemonic', 'rule']
      : ['device', 'oid', 'agent_address'];
  };

  // --------------------------------------------------
  // Hooks (ONLY data sources)
  // --------------------------------------------------
  const {
    tags: syslogTags,
    loading: syslogLoading,
    error: syslogError
  } = useSyslogTags(keycloak, dataSource === 'syslogs');

  const {
    tags: snmpTags,
    loading: snmpLoading,
    error: snmpError
  } = useSnmpTrapTags(keycloak, dataSource === 'snmptraps');

  // --------------------------------------------------
  // Merge defaults + API tags
  // --------------------------------------------------
  const tags = useMemo(() => {
    const defaults = getDefaultTags();

    const apiTags =
      dataSource === 'syslogs'
        ? syslogTags.map(t => t.value)
        : snmpTags.map(t => t.value);

    return Array.from(new Set([...defaults, ...apiTags]));
  }, [dataSource, source, syslogTags, snmpTags]);

  // --------------------------------------------------
  // Set default selected tags
  // --------------------------------------------------
  useEffect(() => {
    setSelTags(defaultSelectedTags().slice(0, 3));
  }, [dataSource, source]);

  // --------------------------------------------------
  // Filtering
  // --------------------------------------------------
  const filteredTags = tags.filter(tag =>
    tag.toLowerCase().includes(searchValue.toLowerCase())
  );

  // --------------------------------------------------
  // Selection logic (max 3)
  // --------------------------------------------------
  const handleTagCheckboxChange = (tag) => {
    if (selTags.includes(tag)) return;

    const next = [...selTags];
    if (next.length >= 3) next.shift();
    next.push(tag);

    setSelTags(next);
  };

  // --------------------------------------------------
  // Loading & error handling
  // --------------------------------------------------
  const loading = syslogLoading || snmpLoading;
  const error = syslogError || snmpError;

  if (loading) {
    return <p>Loading tags...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>Failed to load tags</p>;
  }

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="signalTagContainer">
      <div
        style={{
          padding: '10px',
          height: '350px',
          overflowY: 'auto',
          background: 'var(--backgroundColor3)',
          borderRadius: '8px'
        }}
      >
        <input
          type="text"
          placeholder="Search tags..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="searchTagListElement"
        />

        <ul>
          {filteredTags.map(tag => {
            const isSelected = selTags.includes(tag);
            return (
              <li
                key={tag}
                onClick={() => handleTagCheckboxChange(tag)}
                className={`signalTagItem ${isSelected ? 'selected' : ''}`}
              >
                <input type="checkbox" checked={isSelected} readOnly />
                <span>{tag}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default StatisticTags;
