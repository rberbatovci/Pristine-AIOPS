import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

const SyslogComponents = ({ dataSource, selectedTags, handleTagCheckboxChange }) => {
  const [searchValue, setSearchValue] = useState('');
  const [tags, setTags] = useState([]);

  const fetchSyslogTags = async () => {
    try {
      const response = await apiClient.get('/syslogs/tags/');
      const tagsObject = response.data.map((tag) => ({
        id: tag.id,
        label: tag.name,
        name: tag.name,
      }));
      setTags(['lsn', ...tagsObject.map(tag => tag.name)]);
      console.log('List of Syslog Tag Names:', ['lsn', ...tagsObject.map(tag => tag.name)]);
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

  return (
    <div className="signalTagContainer">
      {!tags.length && <p>Loading tags...</p>}
      {tags.length > 0 && (
        <>
          <div style={{
            padding: '10px',
            height: '350px',
            overflowY: 'auto',
            background: 'var(--backgroundColor3)',
            borderRadius: '8px',
            display: 'block'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search tags..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="searchTagListElement"
                style={{ background: 'var(--buttonBackground)', padding: '6px 8px', borderRadius: '4px', border: 'none', outline: 'none', width: '220px' }}
              />
            </div>
            <div style={{ marginTop: '10px' }}>
              <ul>
                {filteredTags.map((tag, index) => (
                  <li key={index} style={{
                    padding: '8px 12px',
                    marginBottom: '6px',
                    background: 'var(--buttonBackground)',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    opacity: '0.7'
                  }}>
                    <div
                      onClick={() => handleTagCheckboxChange(tag)}
                      style={{
                        display: 'flex',
                        justifyContent: 'start',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => handleTagCheckboxChange(tag)}
                      />
                      <span style={{ paddingLeft: '8px' }}>{tag}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SyslogComponents;