import { useState, useEffect, useMemo } from "react";
import '../../../css/SyslogTagsList.css';

const SnmpTrapEventTags = ({
  tags = [],
  selectedTags = [],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [selTags, setSelTags] = useState(selectedTags);

  useEffect(() => {
    setSelTags(selectedTags);
  }, [selectedTags]);

  useEffect(() => {
    onTagChange && onTagChange(selTags);
  }, [selTags]);

  const handleTagSelection = (tag) => {
    const updated = selTags.includes(tag)
      ? selTags.filter((t) => t !== tag)
      : [...selTags, tag];

    setSelTags(updated);
  };
  // Always include "LSN" at the top
  const allTags = useMemo(() => {
    const cleanTags = tags
      .filter(tag => typeof tag === "string");

    return cleanTags.includes("LSN")
      ? cleanTags
      : ["LSN", ...cleanTags];
  }, [tags]);

  // Filter by search
  const filteredTags = allTags.filter(tag =>
    typeof tag === "string" &&
    tag.toLowerCase().includes(searchValue.toLowerCase())
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
              style={{ background: 'var(--buttonBackground)', padding: '6px 8px', borderRadius: '4px', border: 'none', outline: 'none', width: '220px' }}
            />
          </div>
          <div className="syslogConfigContent" style={{ marginTop: '10px', padding: '10px', height: '350px', overflowY: 'auto' }}>
            <ul>
              {filteredTags.map((tag, index) => (
                <li
                  key={index}
                  className={`button ${selTags.includes(tag) ? 'button-active' : ''
                    }`}
                  style={{
                    height: '20px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '210px',
                  }}
                  onClick={() => handleTagSelection(tag)}
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
                      checked={selTags.includes(tag)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => handleTagSelection(tag)}
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

export default SnmpTrapEventTags;
