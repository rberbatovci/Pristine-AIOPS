import { useState, useCallback } from "react";
import Select from "react-select";
import customStyles from "../misc/SelectStyles";
import "../../css/SearchElement.css";
import { useSyslogTagOptions } from "../../hooks/useSyslogTagOptions";

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

const FilterSyslogs = ({
  keycloak,
  tags,
  onSelectedSyslogFiltersChange
}) => {

  const [selectedTags, setSelectedTags] = useState({});
  const { options, loading, loadOptions } = useSyslogTagOptions(keycloak);

  /* ---------------- HANDLE CHANGE ---------------- */
  // ✅ ONLY store string arrays
  const handleChange = (values, key) => {
    const safeValues = Array.isArray(values)
      ? values.map(v => v.value)
      : [];

    setSelectedTags(prev => ({
      ...prev,
      [key]: safeValues
    }));
  };

  /* ---------------- MAP VALUES ---------------- */
  // ✅ Single, clean declaration that handles fallback elements gracefully
  const mapValuesToOptions = (values = [], availableOptions = []) => {
    if (!values || !Array.isArray(values)) return [];

    return values
      .map(val => availableOptions.find(opt => opt.value === val) || { value: val, label: val })
      .filter(Boolean);
  };

  /* ---------------- LAZY LOAD ---------------- */
  const handleFocus = useCallback((field) => {
    loadOptions(field, selectedTags);
  }, [loadOptions, selectedTags]);

  /* ---------------- SEARCH ---------------- */
  const handleSearchClick = () => {
    const cleaned = Object.fromEntries(
      Object.entries(selectedTags).map(([key, values]) => [
        key,
        Array.isArray(values)
          ? values.map(v => typeof v === "object" ? v.value : v)
          : []
      ]).filter(([_, v]) => v.length > 0)
    );

    console.log("Sending filters:", cleaned);
    onSelectedSyslogFiltersChange(cleaned);
  };

  /* ---------------- RESET ---------------- */
  const handleReset = () => {
    setSelectedTags({});
    onSelectedSyslogFiltersChange({});
  };

  const isEmpty = Object.keys(selectedTags).length === 0;

  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries">

        {/* DEVICE */}
        <FilterSelect
          label="Device"
          options={options?.device || []}
          value={mapValuesToOptions(selectedTags.device, options?.device)}
          loading={loading?.device}
          onChange={(v) => handleChange(v, "device")}
          onFocus={() => handleFocus("device")}
        />

        {/* MNEMONIC */}
        <FilterSelect
          label="Mnemonic"
          options={options?.mnemonic || []}
          value={mapValuesToOptions(selectedTags.mnemonic, options?.mnemonic)}
          loading={loading?.mnemonic}
          onChange={(v) => handleChange(v, "mnemonic")}
          onFocus={() => handleFocus("mnemonic")}
        />

        {/* SEVERITY */}
        <FilterSelect
          label="Severity"
          options={severityOptions}
          value={mapValuesToOptions(selectedTags.severity, severityOptions)}
          onChange={(v) => handleChange(v, "severity")}
        />

        {tags && Array.isArray(tags) && tags.map(tag => {
          const currentOptions = options?.[tag.value] || [];
          const currentSelected = selectedTags?.[tag.value] || [];

          return (
            <FilterSelect
              key={tag.value}
              label={tag.label}
              options={currentOptions}
              value={mapValuesToOptions(currentSelected, currentOptions)}
              loading={loading?.[tag.value] || false}
              onFocus={() => handleFocus(tag.value)}
              onChange={(v) => handleChange(v, tag.value)}
            />
          );
        })}

      </div>

      {/* ACTION BUTTONS */}
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "center",
          gap: "10px",
          margin: "10px"
        }}
      >
        <button
          onClick={handleSearchClick}
          disabled={isEmpty}
          className="button save-button"
        >
          Search
        </button>

        <button
          onClick={handleReset}
          className="button cancel-button"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

/* ---------------- SAFE SELECT ---------------- */
const FilterSelect = ({
  label,
  options,
  value,
  onChange,
  onFocus,
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
      onFocus={onFocus}
      styles={{
        ...customStyles("375px"),
        menuPortal: base => ({ ...base, zIndex: 9999 })
      }}
      menuPortalTarget={document.body}
      placeholder={`Select ${label}`}
    />
  </div>
);

export default FilterSyslogs;