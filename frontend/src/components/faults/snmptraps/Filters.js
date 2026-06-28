import { useState, useCallback, useMemo } from "react";
import Select from "react-select";
import customStyles from "../../misc/SelectStyles";
import "../../../css/SearchElement.css";
import { useSnmpTrapTags } from "../../../hooks/useSnmpTrapTags";

/* ---------------- STATIC OPTIONS ---------------- */
const severityOptions = [
  { value: "emergency", label: "Emergency" },
  { value: "alert", label: "Alert" },
  { value: "critical", label: "Critical" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "notice", label: "Notice" },
  { value: "info", label: "Info" },
  { value: "debug", label: "Debug" }
];

const SnmpTrapEventFilters = ({
  keycloak,
  onSelectedSnmpTrapFiltersChange
}) => {

  /* ---------------- STATE ---------------- */
  const [selectedFilters, setSelectedFilters] = useState({});

  const {
    list: fetchedTagObjects = [],
    loading
  } = useSnmpTrapTags(keycloak);

  /* ---------------- EXTRACT TAG NAMES ---------------- */
  const tagNames = useMemo(() => {
    const predefined = ["Device", "SnmpTrapOid"];

    const apiTags = fetchedTagObjects
      .map(t => t?.name)
      .filter(Boolean);

    return [...new Set([...predefined, ...apiTags])];
  }, [fetchedTagObjects]);

  /* ---------------- HANDLE CHANGE ---------------- */
  const handleChange = (values, key) => {
    const safeValues = Array.isArray(values)
      ? values.map(v => v.value)
      : [];

    setSelectedFilters(prev => ({
      ...prev,
      [key]: safeValues
    }));
  };

  /* ---------------- VALUE MAPPER ---------------- */
  const mapValuesToOptions = (values = [], options = []) => {
    if (!Array.isArray(values)) return [];

    return values
      .map(val =>
        options.find(opt => opt.value === val) || {
          value: val,
          label: val
        }
      )
      .filter(Boolean);
  };

  /* ---------------- SEARCH ---------------- */
  const handleSearchClick = () => {
    const cleaned = Object.fromEntries(
      Object.entries(selectedFilters)
        .filter(([_, v]) => Array.isArray(v) && v.length > 0)
    );

    console.log("Sending filters:", cleaned);
    onSelectedSnmpTrapFiltersChange(cleaned);
  };

  /* ---------------- RESET ---------------- */
  const handleReset = () => {
    setSelectedFilters({});
    onSelectedSnmpTrapFiltersChange({});
  };

  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries"> 

        {/* DYNAMIC TAG FIELDS (THIS IS WHAT YOU WANT) */}
        {tagNames.map(tag => (
          <FilterSelect
            key={tag}
            label={tag}
            options={[]}   // <-- you will fill later per tag
            value={mapValuesToOptions(selectedFilters[tag], [])}
            loading={loading}
            onChange={(v) => handleChange(v, tag)}
          />
        ))}

      </div>

      {/* ACTION BUTTONS */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "10px",
        margin: "10px"
      }}>
        <button onClick={handleSearchClick} className="button save-button">
          Search
        </button>

        <button onClick={handleReset} className="button cancel-button">
          Reset
        </button>
      </div>
    </div>
  );
};

/* ---------------- FILTER SELECT ---------------- */
const FilterSelect = ({
  label,
  options,
  value,
  onChange,
  loading
}) => (
  <div className="searchSyslogsFilterEntry">
    <span className="searchSignalFilterText">{label}:</span>

    <Select
      options={options}
      isMulti
      isLoading={loading}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      styles={{
        ...customStyles("375px"),
        menuPortal: base => ({ ...base, zIndex: 9999 })
      }}
      menuPortalTarget={document.body}
      placeholder={`Select ${label}`}
    />
  </div>
);

export default SnmpTrapEventFilters;