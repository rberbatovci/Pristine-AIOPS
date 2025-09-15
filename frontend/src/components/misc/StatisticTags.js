import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

const StatisticTags = ({ dataSource, source, selTags, setSelTags }) => {
  const [searchValue, setSearchValue] = useState('');
  const [tags, setTags] = useState([]);

  // Define default tags for each scenario
  const getDefaultTags = () => {
    if (source === 'events') {
      if (dataSource === 'syslogs') {
        return ['device', 'mnemonic', 'severity'];
      } else if (dataSource === 'snmptraps') {
        return ['device', 'rules', 'severity', 'enterprise', 'specific_trap'];
      }
    } else if (source === 'signals') {
      if (dataSource === 'syslogs') {
        return ['device', 'mnemonic', 'rule', 'severity'];
      } else if (dataSource === 'snmptraps') {
        return ['device', 'oid', 'agent_address', 'trap_type'];
      }
    }
    // Fallback defaults
    return ['device', 'mnemonic', 'severity'];
  };

  const fetchSyslogTags = async () => {
    try {
      const response = await apiClient.get('/syslogs/tags/');
      const apiTags = response.data.map(tag => tag.name);
      const defaultTags = getDefaultTags();
      const combinedTags = Array.from(new Set([...defaultTags, ...apiTags]));
      setTags(combinedTags);
    } catch (error) {
      console.error('Error fetching syslog tag names:', error);
    }
  };

  const fetchSnmpTrapTags = async () => {
    try {
      const response = await apiClient.get('/snmptraps/tags/');
      const apiTags = response.data.map(tag => tag.name);
      const defaultTags = getDefaultTags();
      const combinedTags = Array.from(new Set([...defaultTags, ...apiTags]));
      setTags(combinedTags);
    } catch (error) {
      console.error('Error fetching snmp trap tag names:', error);
    }
  };

  useEffect(() => {
    if (dataSource === 'syslogs') {
      fetchSyslogTags();
    } else if (dataSource === 'snmptraps') {
      fetchSnmpTrapTags();
    }
  }, [dataSource, source]);

  const filteredTags = tags.filter(tag =>
    typeof tag === 'string' && tag.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleTagCheckboxChange = (tag) => {
    // FIXED: Use selTags (state value) instead of setSelTags (setter function)
    if (selTags.includes(tag)) {
      // Do nothing if tag is already selected (to prevent going below 3)
      return;
    }

    let newTags = [...selTags]; // Copy the current state array

    if (newTags.length >= 3) {
      // Remove the first (oldest) selected tag
      newTags.shift();
    }

    // Add the newly selected tag
    newTags.push(tag);

    // Use the setter function to update the state
    setSelTags(newTags);
  };

  return (
    <div className="signalTagContainer">
      {!tags.length && <p>Loading tags...</p>}
      {tags.length > 0 && (
        <div
          style={{
            padding: '10px',
            height: '350px',
            overflowY: 'auto',
            background: 'var(--backgroundColor3)',
            borderRadius: '8px',
            display: 'block',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search tags..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="searchTagListElement"
              style={{
                background: 'var(--buttonBackground)',
                padding: '6px 8px',
                borderRadius: '4px',
                border: 'none',
                outline: 'none',
                width: '220px',
              }}
            />
          </div>

          <div style={{ marginTop: '10px' }}>
            <ul>
              {filteredTags.map((tag, index) => {
                const isSelected = selTags.includes(tag); // Use selTags here too
                return (
                  <li
                    key={index}
                    onClick={() => handleTagCheckboxChange(tag)}
                    className={`signalTagItem ${isSelected ? 'selected' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        style={{ marginRight: '8px' }}
                      />
                      <span>{tag}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatisticTags;