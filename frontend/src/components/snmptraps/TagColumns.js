import React, { useState } from 'react';
import '../../css/SyslogTagsList.css';

const TagColumns = ({ tags, selectedTags, handleTagCheckboxChange }) => {
  const [searchValue, setSearchValue] = useState('');
  console.log('Tag column options:', tags);

  const allTags = [...tags];
  const filteredTags = allTags.filter(tag =>
    typeof tag === 'string' && tag.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="signalTagContainer">
      {!tags.length && <p>Loading tags...</p>}
      {tags.length > 0 && (
        <>
          <div>
            <input
              type="text"
              placeholder="Search tags..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="searchTagListElement"
              style={{background: 'var(--buttonBackground)', padding: '6px 8px', borderRadius: '4px', border: 'none', outline: 'none', width: '220px'}}
            />
          </div>
          <div className="syslogConfigContent" style={{ marginTop: '10px', padding: '10px', height: '350px', overflowY: 'auto' }}>
            <ul>
              {filteredTags.map((tag, index) => (
                <li
                  key={index}
                  className={`button ${
                    selectedTags.includes(tag) ? 'button-active' : ''
                  }`}
                  style={{
                    height: '20px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '210px',
                  }}
                  onClick={() => handleTagCheckboxChange(tag)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'start',
                      alignItems: 'center',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleTagCheckboxChange(tag)}
                    />
                    <span style={{ paddingLeft: '8px' }}>{tag}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default TagColumns;
