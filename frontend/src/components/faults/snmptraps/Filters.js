import React, { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import customStyles from "../../misc/SelectStyles";
import "../../../css/SearchElement.css";
import { useMnemonics } from "../../../hooks/useMnemonics";
import { useDevices } from "../../../hooks/useDevices";
import { useSyslogTags } from "../../../hooks/useSyslogTags";
import { useStatefulSyslogRules } from "../../../hooks/useStatefulSyslogRules";

const SnmpTrapEventFilters = ({
  keycloak,
  onSelectedSyslogFiltersChange,
  initialSelectedTags = {}
}) => {
  /* -------------------- data hooks -------------------- */
  const { mnemonics = [], loading: mnemonicsLoading } = useMnemonics(keycloak, false);
  const { rules = [], loading: rulesLoading } = useStatefulSyslogRules(keycloak, false);
  const { tags = [], loading: tagsLoading } = useSyslogTags(keycloak);
  const { devices = [] } = useDevices(keycloak, false);

  /* -------------------- local state -------------------- */
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
  const [tagOptions, setTagOptions] = useState({});

  /* -------------------- derived options -------------------- */
  const deviceOptions = devices.map(d => ({
    value: d.hostname,
    label: d.hostname
  }));

  /* -------------------- init selected tags -------------------- */
  useEffect(() => {
    if (!tags.length) return;

    setSelectedTags(prev => {
      const initialized = { ...prev };

      tags.forEach(tag => {
        const keyName = tag.value || tag.name; // handles both payload structures
        if (!initialized[keyName]) {
          initialized[keyName] = [];
        }
      });

      onSelectedSyslogFiltersChange(initialized);
      return initialized;
    });
  }, [tags, onSelectedSyslogFiltersChange]);

  /* -------------------- handle change -------------------- */
  // ✅ ONLY store clean string arrays matching FilterSyslogs implementation
  const handleChange = useCallback((values, key) => {
    const safeValues = Array.isArray(values)
      ? values.map(v => v.value)
      : [];

    setSelectedTags(prev => {
      const updated = {
        ...prev,
        [key]: safeValues
      };
      onSelectedSyslogFiltersChange(updated);
      return updated;
    });
  }, [onSelectedSyslogFiltersChange]);

  /* -------------------- map values -------------------- */
  // ✅ Convert stored strings -> react-select object format safely
  const mapValuesToOptions = (selectedValues = [], availableOptions = []) => {
    if (!selectedValues || !Array.isArray(selectedValues)) return [];

    return selectedValues
      .map(val => availableOptions.find(opt => opt.value === val) || { value: val, label: val })
      .filter(Boolean);
  };

  /* -------------------- focus handler (lazy load) -------------------- */
  const handleFocus = useCallback((tagName) => {
    if (tagOptions[tagName]) return;

    if (tagName === "mnemonic") {
      setTagOptions(prev => ({
        ...prev,
        mnemonic: mnemonics.map(m => ({
          value: m.name,
          label: m.label
        }))
      }));
      return;
    }

    if (tagName === "rule") {
      setTagOptions(prev => ({
        ...prev,
        rule: rules.map(r => ({
          value: r.name,
          label: r.label
        }))
      }));
      return;
    }
  }, [tagOptions, mnemonics, rules]);

  /* -------------------- render -------------------- */
  if (tagsLoading) {
    return <p style={{ textAlign: "center" }}>Loading Trap Filters…</p>;
  }

  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries">

        {/* Devices */}
        <FilterSelect
          label="Device"
          options={deviceOptions}
          value={mapValuesToOptions(selectedTags.device, deviceOptions)}
          onChange={(v) => handleChange(v, "device")}
        />

        {/* SNMP Trap OIDs */}
        <FilterSelect
          label="SNMP Trap OID"
          options={tagOptions.snmpTrapOids || []}
          value={mapValuesToOptions(selectedTags.snmpTrapOids, tagOptions.snmpTrapOids || [])}
          onChange={(v) => handleChange(v, "snmpTrapOids")}
          onFocus={() => handleFocus("snmpTrapOids")}
        />

        {/* Dynamic Tags */}
        {Array.isArray(tags) && tags.map((tag) => {
          const tagKey = tag.value || tag.name;
          const tagLabel = tag.label || tag.name;
          const currentOptions = tagOptions?.[tagKey] || [];
          const currentSelected = selectedTags?.[tagKey] || [];

          return (
            <FilterSelect
              key={tagKey}
              label={tagLabel}
              options={currentOptions}
              value={mapValuesToOptions(currentSelected, currentOptions)}
              onChange={(v) => handleChange(v, tagKey)}
              onFocus={() => handleFocus(tagKey)}
            />
          );
        })}

      </div>
    </div>
  );
};

/* ---------------- SAFE SELECT COMPONENT ---------------- */
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
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
        onFocus={onFocus}
        styles={{
          ...customStyles("375px"),
          menuPortal: base => ({ ...base, zIndex: 9999 })
        }}
        menuPortalTarget={document.body}
        placeholder={`Select ${label.toLowerCase()}`}
      />
    </div>
  </div>
);

export default SnmpTrapEventFilters;