import { useState, useMemo } from "react";
import "../../../css/SyslogTagsList.css";
import { useSyslogTags } from "../../../hooks/useSyslogTags";

const SyslogEventTableTags = ({
  keycloak,
  selectedTags = [
    { label: 'Timestamp', value: 'timestamp' },
    { label: 'Device', value: 'device' },
    { label: 'Severity', value: 'severity' },
    { label: 'Mnemonic', value: 'mnemonic' },
    { label: 'Message', value: 'message' },
  ],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState("");

  const { tags: fetchedTagObjects = [], loading, error } = useSyslogTags(keycloak);

  const allTags = useMemo(() => {
    const predefinedTags = [
    { label: 'Timestamp', value: 'timestamp' },
    { label: 'Device', value: 'device' },
    { label: 'Severity', value: 'severity' },
    { label: 'Mnemonic', value: 'mnemonic' },
    { label: 'Message', value: 'message' },
    { label: 'LSN', value: 'lsn' },
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

    return allTags.filter(tag =>
      tag.label.toLowerCase().includes(search)
    );
  }, [allTags, searchValue]);

  const handleTagSelection = (tag) => {
    if (!onTagChange) return;

    const exists = selectedTags.some(t => t.value === tag.value);

    const updated = exists
      ? selectedTags.filter(t => t.value !== tag.value)
      : [...selectedTags, tag];

    onTagChange(updated);
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
        />

        {loading && <div>Loading tags...</div>}
        {error && <div>Error loading tags</div>}

        {!loading && filteredTags.length === 0 && (
          <div>No tags found</div>
        )}

        <ul>
          {filteredTags.map(tag => {
            const isSelected = selectedTags.some(
              t => t.value === tag.value
            );

            return (
              <li
                key={tag.value}
                className={`signalTagItem ${isSelected ? "selected" : ""}`}
                onClick={() => handleTagSelection(tag)}
              >
                <input type="checkbox" checked={isSelected} readOnly />
                <span>{tag.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default SyslogEventTableTags;