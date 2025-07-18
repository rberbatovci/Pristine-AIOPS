import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

const TrapComponents = ({ selTrapEventsTags, setSelTrapEventsTags }) => {
  const [searchValue, setSearchValue] = useState('');
  const [tags, setTags] = useState([]);

  const defaultTags = ['device', 'snmpTrapOid', 'Interface'];

  useEffect(() => {
    const fetchSyslogTags = async () => {
      try {
        const response = await apiClient.get('/traps/tags/');
        const apiTags = response.data.map(tag => tag.name);
        const combinedTags = Array.from(new Set([...defaultTags, ...apiTags]));
        setTags(combinedTags);
      } catch (error) {
        console.error('Error fetching syslog tag names:', error);
      }
    };

    fetchSyslogTags();

    if (selTrapEventsTags.length === 0) {
      setSelTrapEventsTags(defaultTags);
    }
  }, []);

  const filteredTags = tags.filter(tag =>
    typeof tag === 'string' && tag.toLowerCase().includes(searchValue.toLowerCase())
  );

const handleTagCheckboxChange = (tag) => {
  if (selTrapEventsTags.includes(tag)) {
    // Do nothing if tag is already selected (to prevent going below 3)
    return;
  }

  let newTags = [...selTrapEventsTags];

  if (newTags.length >= 3) {
    // Remove the first (oldest) selected tag
    newTags.shift();
  }

  // Add the newly selected tag
  newTags.push(tag);

  setSelTrapEventsTags(newTags);
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
                const isSelected = selTrapEventsTags.includes(tag);
                return (
                  <li
                    key={index}
                    onClick={() => handleTagCheckboxChange(tag)}
                    style={{
                      padding: '8px 12px',
                      marginBottom: '6px',
                      background: isSelected ? 'var(--highlightColor)' : 'var(--buttonBackground)',
                      color: isSelected ? 'white' : 'inherit',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: isSelected ? 1 : 0.7,
                      cursor: 'pointer',
                    }}
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

export default TrapComponents;
