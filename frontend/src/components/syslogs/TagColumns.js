import React, { useState, useEffect, useMemo } from "react";
import "../../css/SyslogTagsList.css";
import { useSyslogTags } from "../../hooks/useSyslogTags";
import { useSnmpTrapTags } from "../../hooks/useSnmpTrapTags";

const SyslogTags = ({
  keycloak,
  dataSource,
  selectedTags = [],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selTags, setSelTags] = useState(selectedTags);

  // Load tags using hooks
  const {
    tags: syslogTags,
    loading: syslogLoading,
    error: syslogError
  } = useSyslogTags(keycloak, dataSource === "syslogs");

  const {
    tags: trapTags,
    loading: trapLoading,
    error: trapError
  } = useSnmpTrapTags(keycloak, dataSource === "snmptraps");

  // Pick correct tag source
  const activeTags = useMemo(() => {
    if (dataSource === "syslogs") {
      return ["lsn", ...syslogTags.map(t => t.value)];
    }
    if (dataSource === "snmptraps") {
      return trapTags.map(t => t.value);
    }
    return [];
  }, [dataSource, syslogTags, trapTags]);

  // Notify parent when selection changes
  useEffect(() => {
    onTagChange && onTagChange(selTags);
  }, [selTags, onTagChange]);

  // Toggle selection
  const handleTagSelection = (tag) => {
    const updated = selTags.includes(tag)
      ? selTags.filter((t) => t !== tag)
      : [...selTags, tag];

    setSelTags(updated);
  };

  const filteredTags = activeTags.filter(tag =>
    tag.toLowerCase().includes(searchValue.toLowerCase())
  );

  const loading = syslogLoading || trapLoading;
  const error = syslogError || trapError;

  return (
    <div className="signalTagContainer">
      {loading && <p>Loading tags...</p>}
      {error && <p style={{ color: "red" }}>{error.message || "Error loading tags"}</p>}

      {!loading && !error && (
        <div className="signalTagList">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="signalSearchItem"
            style={{ width: "220px", outline: "none" }}
          />

          <ul>
            {filteredTags.map((tag, index) => (
              <li
                key={index}
                className={`signalTagItem ${
                  selTags.includes(tag) ? "selected" : ""
                }`}
                onClick={() => handleTagSelection(tag)}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={selTags.includes(tag)}
                    readOnly
                    style={{
                      marginRight: "6px",
                      accentColor: "#2196f3"
                    }}
                  />
                  <span style={{ paddingLeft: "8px" }}>{tag}</span>
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