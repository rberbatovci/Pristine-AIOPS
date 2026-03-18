import React, { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import customStyles from "../misc/SelectStyles";
import "../../css/SearchElement.css";
import { useMnemonics } from "../../hooks/useMnemonics";
import { useDevices } from "../../hooks/useDevices";
import { useSyslogTags } from "../../hooks/useSyslogTags";
import { useStatefulSyslogRules } from "../../hooks/useStatefulSyslogRules";

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

const FilterTraps = ({
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
        if (!initialized[tag.name]) {
          initialized[tag.name] = [];
        }
      });

      onSelectedSyslogFiltersChange(initialized);
      return initialized;
    });
  }, [tags, onSelectedSyslogFiltersChange]);

  /* -------------------- generic change handler -------------------- */
  const handleChange = useCallback((values, tagName) => {
    setSelectedTags(prev => {
      const updated = {
        ...prev,
        [tagName]: values || []
      };

      onSelectedSyslogFiltersChange(updated);
      return updated;
    });
  }, [onSelectedSyslogFiltersChange]);

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

    // Future dynamic loader here
  }, [tagOptions, mnemonics, rules]);

  /* -------------------- render -------------------- */
  if (tagsLoading) {
    return <p style={{ textAlign: "center" }}>Loading Syslog Tags…</p>;
  }

  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries">

        {/* Devices */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Device:</span>
          <div style={{ marginTop: '6px' }}>
            <Select
              options={deviceOptions}
              isMulti
              value={selectedTags.device || []}
              onChange={(v) => handleChange(v, "device")}
              styles={{
                ...customStyles('375px'),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
              placeholder="Select devices"
            />
          </div>
        </div>

        {/* Mnemonics */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Mnemonic:</span>
          <div style={{ marginTop: '6px' }}>
            <Select
              options={tagOptions.mnemonic || []}
              isMulti
              value={selectedTags.mnemonic || []}
              onChange={(v) => handleChange(v, 'mnemonic')}
              onFocus={() => handleFocus("mnemonic")}
              styles={{
                ...customStyles('375px'),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
              placeholder="Select mnemonics"
            />
          </div>
        </div>

        {/* Severity */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Severity:</span>
          <div style={{ marginTop: '6px' }}>
            <Select
              options={severityOptions}
              isMulti
              value={selectedTags.severity || []}
              onChange={(v) => handleChange(v, "severity")}
              styles={{
                ...customStyles('375px'),
                menuPortal: base => ({ ...base, zIndex: 9999 })
              }}
              menuPortalTarget={document.body}
              placeholder="Select severity"
            />
          </div>
        </div>

        {/* Dynamic Tags (optional) */}
        {tags.map((tag) => (
          <div key={tag.name} className="searchSyslogsFilterEntry">
            <span className="searchSignalFilterText">{tag.label}:</span>
            <div style={{ marginTop: '6px' }}>
              <Select
                options={tagOptions[tag.name] || []}
                isMulti
                value={selectedTags[tag.name] || []}
                onChange={(v) => handleChange(v, tag.name)}
                onFocus={() => handleFocus(tag.name)}
                styles={{
                  ...customStyles('375px'),
                  menuPortal: base => ({ ...base, zIndex: 9999 })
                }}
                menuPortalTarget={document.body}
                placeholder={`Select ${tag.label}`}
              />
            </div>
          </div>
        ))}

      </div>
    </div>
  );
};

export default FilterTraps;