import React, { useState } from 'react';
import Select from 'react-select';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';

import { useSyslogTags } from "../../../hooks/useSyslogTags";
import { useSyslogSignalsTagOptions } from "../../../hooks/useSyslogSignalsTagOptions";

const SyslogSignalFilters = ({
  keycloak,
  onSelectedSyslogFiltersChange,
  initialSelectedTags = {}
}) => {
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags);

  const {
    tags,
    loading: tagsLoading,
    error: tagsError
  } = useSyslogTags(keycloak);

  const {
    options,
    loading,
    fetchOptions
  } = useSyslogSignalsTagOptions(keycloak);

  const handleChange = (values, tagName) => {
    const updated = {
      ...selectedTags,
      [tagName]: values
    };
    setSelectedTags(updated);
    onSelectedSyslogFiltersChange(updated);
  };

  if (tagsLoading) {
    return <p>Loading Syslog Tags...</p>;
  }

  if (tagsError) {
    return <p>Failed to load tags</p>;
  }

  return (
    <div className="dropdownConfigContainer" style={{ padding: '10px', width: '400px' }}>
      <span>Filter Syslog Signals:</span>

      <div className="searchSyslogsFilterEntries" style={{ marginTop: '8px', padding: '10px' }}>
        {['device', 'mnemonic', 'rule'].map(tagName => (
          <div key={tagName} className="searchSyslogsFilterEntry">
            <span className="searchSignalFilterText">
              {tagName.charAt(0).toUpperCase() + tagName.slice(1)}:
            </span>
            <Select
              isMulti
              name={tagName}
              options={options[tagName] || []}
              value={selectedTags[tagName] || []}
              onChange={(v) => handleChange(v, tagName)}
              onFocus={() => fetchOptions(tagName)}
              isLoading={loading[tagName]}
              styles={customStyles('370px')}
            />
          </div>
        ))}

        {tags.map(tag => (
          <div key={tag.name} className="searchSyslogsFilterEntry">
            <span className="searchSignalFilterText">{tag.name}:</span>
            <Select
              isMulti
              name={tag.name}
              options={options[tag.name] || []}
              value={selectedTags[tag.name] || []}
              onChange={(v) => handleChange(v, tag.name)}
              onFocus={() => fetchOptions(tag.name)}
              isLoading={loading[tag.name]}
              styles={customStyles('370px')}
            />
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button style={{ padding: '8px 60px', color: 'green' }}>
          Search
        </button>
      </div>
    </div>
  );
};

export default SyslogSignalFilters;
