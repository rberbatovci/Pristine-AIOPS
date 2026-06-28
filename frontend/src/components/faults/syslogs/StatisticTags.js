import { useState, useMemo } from "react";
import "../../../css/SyslogTagsList.css";
import { useSyslogTags } from "../../../hooks/useSyslogTags";

const SyslogEventStatisticTags = ({
  keycloak,
  selectedTags = [
    { label: 'Device', value: 'device' },
    { label: 'Severity', value: 'severity' },
    { label: 'Mnemonic', value: 'mnemonic' },
    { label: 'State', value: 'state' },
    { label: 'Interface', value: 'interface' },
    { label: 'Neighbor', value: 'neighbor' }
  ],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState("");

  const {
    tags: fetchedTagObjects = [], loading, error } = useSyslogTags(keycloak);

  const allTags = useMemo(() => {
    const predefinedTags = [
      { label: 'Device', value: 'device' },
      { label: 'Severity', value: 'severity' },
      { label: 'Mnemonic', value: 'mnemonic' },
      { label: 'State', value: 'state' },
      { label: 'Interface', value: 'interface' },
      { label: 'Neighbor', value: 'neighbor' }
    ];

    const apiTags = fetchedTagObjects
      .filter(tag => tag && tag.label && tag.value);

    const combined = [...predefinedTags, ...apiTags];

    const uniqueTags = [];
    const seen = new Set();

    for (const tag of combined) {
      if (!seen.has(tag.value)) {
        seen.add(tag.value);
        uniqueTags.push(tag);
      }
    }

    return uniqueTags;
  }, [fetchedTagObjects]);

  const filteredTags = useMemo(() => {
    const search = searchValue.toLowerCase();

    return allTags.filter(
      tag =>
        tag.label?.toLowerCase().includes(search) ||
        tag.value?.toLowerCase().includes(search)
    );
  }, [allTags, searchValue]);

  console.log("All Tags:", allTags);
  console.log("Filtered Tags:", filteredTags);

  const handleTagSelection = (tag) => {
    if (!onTagChange) return;

    const updatedTags = selectedTags.some(
      t => t.value === tag.value
    )
      ? selectedTags.filter(
        t => t.value !== tag.value
      )
      : [...selectedTags, tag];

    onTagChange(updatedTags);
  };

  return (
    <div className="signalTagContainer">
      <div className="signalTagList">
        <input
          type="text"
          placeholder="Search tags..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="signalSearchItem"
          style={{
            width: "220px",
            outline: "none"
          }}
        />

        {loading && (
          <div className="tag-status">
            Loading tags...
          </div>
        )}

        {error && (
          <div className="tag-status error">
            Error loading tags
          </div>
        )}

        {!loading && filteredTags.length === 0 && (
          <div className="tag-status">
            No tags found
          </div>
        )}

        <ul>
          {filteredTags.map((tag) => {
            const isSelected = selectedTags.some(
              t => t.value === tag.value
            );

            return (
              <li
                key={tag.value}
                className={`signalTagItem ${isSelected ? "selected" : "" }`}
                onClick={() => handleTagSelection(tag)} > 
                  <input type="checkbox" checked={isSelected} readOnly />
                  <span style={{ paddingLeft: "8px" }}>
                    {tag.label}
                  </span> 
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default SyslogEventStatisticTags;