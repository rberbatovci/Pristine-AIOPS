import { useState, useMemo } from "react";
import "../../../css/SyslogTagsList.css";
import { useSnmpTrapTags } from "../../../hooks/useSnmpTrapTags";

const SnmpTrapEventTableTags = ({
  keycloak,
  selectedTags = [
    { label: 'Timestamp', value: 'timestamp' },
    { label: 'Device', value: 'device' },
    { label: 'System Uptime', value: 'sysUpTime' },
    { label: 'SNMP Trap OID', value: 'snmpTrapOid' },
    { label: 'Content', value: 'content' }
  ],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState("");

  const { list: tags = [], loading, error } = useSnmpTrapTags(keycloak);


  const filteredTags = useMemo(() => {
    const search = searchValue.toLowerCase().trim();

    if (!search) {
      return tags;
    }

    return tags.filter((tag) =>
      tag.label.toLowerCase().includes(search)
    );
  }, [tags, searchValue]);

  const handleTagSelection = (tag) => {
    if (!onTagChange) return;

    const exists = selectedTags.some(
      (t) => t.value === tag.value
    );

    const updated = exists
      ? selectedTags.filter(
        (t) => t.value !== tag.value
      )
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

export default SnmpTrapEventTableTags;