import { useState, useEffect, useMemo } from "react";
import "../../../css/SyslogTagsList.css";

const SyslogEventTableTags = ({
  tags = [],
  selectedTags = [],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState("");
  const [selTags, setSelTags] = useState(selectedTags);

  // Keep local state in sync with parent
  useEffect(() => {
    setSelTags(selectedTags);
  }, [selectedTags]);

  // Notify parent
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
    const tagValues = tags.includes("LSN") ? tags : ["LSN", ...tags];
    return tagValues;
  }, [tags]);

  // Filter by search
  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className="signalTagContainer">
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
    </div>
  );
};

export default SyslogEventTableTags;