import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

const SyslogTags = ({ dataSource, selectedTags = [], onTagChange }) => {
  const [searchValue, setSearchValue] = useState('');
  const [tags, setTags] = useState([]);
  const [selTags, setSelTags] = useState(selectedTags);

  useEffect(() => {
    if (dataSource === 'syslogs') fetchSyslogTags();
    else if (dataSource === 'snmptraps') fetchTrapTags();
  }, [dataSource]);

  useEffect(() => {
    onTagChange && onTagChange(selTags);
  }, [selTags, onTagChange]);

  const fetchTrapTags = async () => {
    try {
      const response = await apiClient.get('/traps/tags/');
      const tagNames = response.data.map((tag) => tag.name);
      setTags(tagNames);
    } catch (error) {
      console.error('Error fetching trap tag names:', error);
    }
  };

  const fetchSyslogTags = async () => {
    try {
      const response = await apiClient.get('/syslogs/tags/');
      const tagNames = ['lsn', ...response.data.map((tag) => tag.name)];
      setTags(tagNames);
    } catch (error) {
      console.error('Error fetching syslog tag names:', error);
    }
  };

  const handleTagSelection = (tag) => {
    const updated = selTags.includes(tag)
      ? selTags.filter((t) => t !== tag)
      : [...selTags, tag];
    setSelTags(updated);
  };

  const handleDeleteTag = async (tagName) => {
    if (!window.confirm(`Are you sure you want to delete "${tagName}"?`)) return;
    try {
      await apiClient.delete(`/syslogs/tags/${tagName}`);
      dataSource === 'syslogs' ? fetchSyslogTags() : fetchTrapTags();
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to delete tag';
      alert(`Error: ${errorMessage}`);
    }
  };

  const filteredTags = tags.filter(tag =>
    tag.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="signalTagContainer">
      {!tags.length && <p>Loading tags...</p>}
      {!!tags.length && (
        <div className="signalTagList">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="signalSearchItem"
            style={{ width: '220px', outline: 'none' }}
          />
          <ul>
            {filteredTags.map((tag, index) => (
              <li
                key={index}
                className={`signalTagItem ${selTags.includes(tag) ? 'selected' : ''}`}
                onClick={() => handleTagSelection(tag)}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selTags.includes(tag)}
                    readOnly
                    style={{ marginRight: '6px', accentColor: '#2196f3' }}
                  />
                  <span style={{ paddingLeft: '8px' }}>{tag}</span>
                </div>
                
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SyslogTags;
