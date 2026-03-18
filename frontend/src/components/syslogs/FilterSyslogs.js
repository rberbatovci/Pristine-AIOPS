import React, { useState, useCallback } from "react";
import Select from "react-select";
import customStyles from "../misc/SelectStyles";
import "../../css/SearchElement.css";

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
  devices,
  tags,
  onSelectedSyslogFiltersChange
}) => {

  /* -------------------- state -------------------- */
  const [selectedTags, setSelectedTags] = useState({});
  const [optionsCache, setOptionsCache] = useState({}); // 🔥 dynamic options cache
  const [loadingFields, setLoadingFields] = useState({});

  /* -------------------- static options -------------------- */
  const deviceOptions = devices.map(d => ({
    value: d.hostname,
    label: d.hostname
  }));

  /* -------------------- change handler -------------------- */
  const handleChange = (value, key) => {
    const updated = {
      ...selectedTags,
      [key]: value || []
    };

    setSelectedTags(updated);
    onSelectedSyslogFiltersChange(updated);
  };

  /* -------------------- fetch from backend -------------------- */
  const fetchOptions = async (field) => {
    try {
      setLoadingFields(prev => ({ ...prev, [field]: true }));

      const res = await fetch(`/api/syslogs/options/${field}`);
      const data = await res.json();

      const formatted = data.map(item => ({
        value: item.value,
        label: item.label || item.value
      }));

      setOptionsCache(prev => ({
        ...prev,
        [field]: formatted
      }));
    } catch (err) {
      console.error(`Failed to fetch ${field}`, err);
    } finally {
      setLoadingFields(prev => ({ ...prev, [field]: false }));
    }
  };

  /* -------------------- focus handler (lazy load) -------------------- */
  const handleFocus = useCallback((field) => {
    if (optionsCache[field]) return; // ✅ already loaded

    fetchOptions(field);
  }, [optionsCache]);


  /* -------------------- render -------------------- */
  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries">

        {/* Devices */}
        <FilterSelect
          label="Device"
          options={deviceOptions}
          value={selectedTags.device}
          onChange={(v) => handleChange(v, "device")}
        />

        {/* Mnemonics */}
        <FilterSelect
          label="Mnemonic"
          options={optionsCache.mnemonic || []}
          value={selectedTags.mnemonic}
          loading={loadingFields.mnemonic}
          onFocus={() => handleFocus("mnemonic")}
          onChange={(v) => handleChange(v, "mnemonic")}
        />

        {/* Severity */}
        <FilterSelect
          label="Severity"
          options={severityOptions}
          value={selectedTags.severity}
          onChange={(v) => handleChange(v, "severity")}
        />

        {/* Dynamic tags */}
        {tags.map(tag => {
          console.log("Rendering tag:", tag);
          return (
            <FilterSelect
              key={tag.name}
              label={tag.label}
              options={optionsCache[tag.name] || []}
              value={selectedTags[tag.name]}
              loading={loadingFields[tag.name]}
              onFocus={() => handleFocus(tag.name)}
              onChange={(v) => handleChange(v, tag.name)}
            />
          );
        })}

      </div>
    </div>
  );
};

/* -------------------- reusable select -------------------- */
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
    <div style={{ marginTop: "6px" }}>
      <Select
        options={options}
        isMulti
        isLoading={loading}
        value={value || []}
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
  </div>
);

export default FilterSyslogs;