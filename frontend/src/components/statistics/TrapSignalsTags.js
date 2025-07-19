import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';


const TrapSignalsTags = ({ selTrapSignalsTags, setSelTrapSignalsTags }) => {
  const [searchValue, setSearchValue] = useState('');
  const [tags, setTags] = useState([]);

  const defaultTags = ['device', 'mnemonic', 'severity']; // includes custom non-API ones

  const fetchSyslogTags = async () => {
    try {
      const response = await apiClient.get('/syslogs/tags/');
      const apiTags = response.data.map(tag => tag.name);
      const combinedTags = Array.from(new Set([...defaultTags, ...apiTags]));
      setTags(combinedTags);

      if (selTrapSignalsTags.length === 0) {
        setSelTrapSignalsTags(defaultTags);
      }
    } catch (error) {
      console.error('Error fetching syslog tag names:', error);
    }
  };

  useEffect(() => {
    fetchSyslogTags();
  }, []);

  const filteredTags = tags.filter(tag =>
    typeof tag === 'string' && tag.toLowerCase().includes(searchValue.toLowerCase())
  );


  const handleTagCheckboxChange = (tag) => {
    if (selTrapSignalsTags.includes(tag)) {
      // Do nothing if tag is already selected (to prevent going below 3)
      return;
    }

    let newTags = [...selTrapSignalsTags];

    if (newTags.length >= 3) {
      // Remove the first (oldest) selected tag
      newTags.shift();
    }

    // Add the newly selected tag
    newTags.push(tag);

    setSelTrapSignalsTags(newTags);
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
                const isSelected = selTrapSignalsTags.includes(tag);
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

export default TrapSignalsTags;
