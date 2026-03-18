import React, { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import customStyles from "../../../misc/SelectStyles";
import "../../../css/SearchElement.css";

import { useMnemonics } from "../../../hooks/useMnemonics";
import { useDevices } from "../../../hooks/useDevices";
import { useSyslogTags } from "../../../hooks/useSyslogTags";
import { useStatefulSyslogRules } from "../../../hooks/useStatefulSyslogRules";
///import { useTagSignalOptions } from "../../../hooks/useTagSignalOptions";  <---- CHECK THIS ONE

const Syslogs = ({
  keycloak,
  onSelectedSyslogFiltersChange,
  initialSelectedTags = {}
}) => {
  /* -------------------- data hooks -------------------- */
  const { mnemonics, loading: mnemonicsLoading } = useMnemonics(keycloak, false);
  const { rules, loading: rulesLoading } = useStatefulSyslogRules(keycloak, false);
  const { tags, loading: tagsLoading } = useSyslogTags(keycloak);
  const { devices } = useDevices(keycloak, false);

  /* -------------------- local state -------------------- */
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
  const [tagOptions, setTagOptions] = useState({});

  /* -------------------- init selected tags -------------------- */
  useEffect(() => {
    if (!tags.length) return;

    const initialized = { ...selectedTags };
    tags.forEach(tag => {
      if (!initialized[tag.name]) {
        initialized[tag.name] = [];
      }
    });

    setSelectedTags(initialized);
    onSelectedSyslogFiltersChange(initialized);
  }, [tags]);

  /* -------------------- change handler -------------------- */
  const handleChange = useCallback((values, tagName) => {
    const updated = {
      ...selectedTags,
      [tagName]: values
    };
    setSelectedTags(updated);
    onSelectedSyslogFiltersChange(updated);
  }, [selectedTags, onSelectedSyslogFiltersChange]);

  /* -------------------- focus handler -------------------- */
  const handleFocus = async (tagName) => {
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

    //WATCH THIS ONE.XXXXXXXXXs
    //const options = await useTagSignalOptions(keycloak, tagName);
    //setTagOptions(prev => ({ ...prev, [tagName]: options }));
  };

  /* -------------------- render -------------------- */
  if (tagsLoading) {
    return <p style={{ textAlign: "center" }}>Loading Syslog Tags…</p>;
  }

  return (
    <div className="search-signals-container">
      {/* Mnemonics */}
      <div className="search-signals-item">
        <p>Mnemonic:</p>
        <Select
          isMulti
          options={tagOptions.mnemonic || []}
          value={selectedTags.mnemonic || []}
          onChange={(v) => handleChange(v, "mnemonic")}
          onFocus={() => handleFocus("mnemonic")}
          styles={customStyles}
          isLoading={mnemonicsLoading}
        />
      </div>

      {/* Stateful rules */}
      <div className="search-signals-item">
        <p>Stateful Rule:</p>
        <Select
          isMulti
          options={tagOptions.rule || []}
          value={selectedTags.rule || []}
          onChange={(v) => handleChange(v, "rule")}
          onFocus={() => handleFocus("rule")}
          styles={customStyles}
          isLoading={rulesLoading}
        />
      </div>

      {/* Dynamic tags */}
      {tags.map(tag => (
        <div key={tag.name} className="search-signals-item">
          <p>{tag.name}:</p>
          <Select
            isMulti
            options={tagOptions[tag.name] || []}
            value={selectedTags[tag.name]}
            onChange={(v) => handleChange(v, tag.name)}
            onFocus={() => handleFocus(tag.name)}
            styles={customStyles}
          />
        </div>
      ))}
    </div>
  );
};

export default Syslogs;
