import { useState, useMemo } from "react";
import "../../../css/SyslogTagsList.css";
import { useSnmpTrapTags } from "../../../hooks/useSnmpTrapTags";

const SnmpTrapEventStatisticTags = ({
  keycloak,
  selectedTags = [],
  onTagChange
}) => {
  const [searchValue, setSearchValue] = useState("");

  const {
    list: fetchedTagObjects = [],
    loading,
    error
  } = useSnmpTrapTags(keycloak);

  const allTags = useMemo(() => {
    const predefinedTags = ["Device", "SnmpTrapOid"];

    const apiTags = fetchedTagObjects
      .map(tag => tag?.name)
      .filter(Boolean);

    console.log("API Tags:", apiTags);

    return [...new Set([...predefinedTags, ...apiTags])];
  }, [fetchedTagObjects]);

  const filteredTags = useMemo(() => {
    const search = searchValue.toLowerCase();

    return allTags.filter(
      tag =>
        typeof tag === "string" &&
        tag.toLowerCase().includes(search)
    );
  }, [allTags, searchValue]);

  console.log("All Tags:", allTags);
  console.log("Filtered Tags:", filteredTags);

  const handleTagSelection = (tag) => {
    if (!onTagChange) return;

    const updatedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
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
            const isSelected = selectedTags.includes(tag);

            return (
              <li
                key={tag}
                className={`signalTagItem ${isSelected ? "selected" : ""
                  }`}
                onClick={() => handleTagSelection(tag)}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{
                      marginRight: "6px",
                      accentColor: "#2196f3"
                    }}
                  />

                  <span style={{ paddingLeft: "8px" }}>
                    {tag}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default SnmpTrapEventStatisticTags;