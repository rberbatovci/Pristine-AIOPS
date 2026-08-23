import { useState, useCallback, useMemo } from "react";
import Select from "react-select";
import customStyles from "../../misc/SelectStyles";
import "../../../css/SearchElement.css";
import { useSyslogTags } from "../../../hooks/useSyslogTags";
import kcFetch from "../../misc/kcFetch";
import { useFilterOptions  } from "../../../hooks/useFilterOptions";

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

const SyslogSignalFilters = ({
  keycloak,
  onSelectedSyslogFiltersChange
}) => {

  /* ---------------- STATE ---------------- */
  const [selectedFilters, setSelectedFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [loadingField, setLoadingField] = useState(null);
  const { getOptions } = useFilterOptions(keycloak);
  const {
    tags: fetchedTagObjects = [],
    loading
  } = useSyslogTags(keycloak);

  /* ---------------- EXTRACT TAG NAMES ---------------- */
  const tagNames = useMemo(() => {
    const predefined = ["Device", "Severity", "Mnemonic"];

    const apiTags = fetchedTagObjects
      .map(t => t?.label)
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

  /* ---------------- BUILD CASCADING QUERY ---------------- */
  const buildQueryString = (filters, skipField) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, values]) => {
      if (key === skipField) return;

      const backendField =
        ["Device", "Severity", "Mnemonic"].includes(key)
          ? key.toLowerCase()
          : key;

      values.forEach(value => {
        params.append(backendField, value);
      });
    });

    return params.toString();
  };

  const loadOptions = useCallback(async (field) => {

    if (filterOptions[field]) return;

    setLoadingField(field);

    try {

      const backendField =
        ["Device", "Severity", "Mnemonic"].includes(field)
          ? field.toLowerCase()
          : field;

      const filters = {};

      Object.entries(selectedFilters).forEach(([key, values]) => {

        if (key === field) return;

        const backendKey =
          ["Device", "Severity", "Mnemonic"].includes(key)
            ? key.toLowerCase()
            : key;

        filters[backendKey] = values;

      });

      const options = await getOptions({
        resource: "syslogs",
        field: backendField,
        filters
      });

      setFilterOptions(prev => ({
        ...prev,
        [field]: options
      }));

    } catch (err) {
      console.error(err);
    } finally {
      setLoadingField(null);
    }

  }, [filterOptions, selectedFilters, getOptions]);

  /* ---------------- SEARCH ---------------- */
  const handleSearchClick = () => {

    const cleaned = Object.fromEntries(
      Object.entries(selectedFilters)
        .filter(([_, v]) => Array.isArray(v) && v.length > 0)
        .map(([key, values]) => {
          const backendField =
            ["Device", "Severity", "Mnemonic"].includes(key)
              ? key.toLowerCase()
              : key;

          return [backendField, values];
        })
    );

    console.log("Sending filters:", cleaned);

    onSelectedSyslogFiltersChange(cleaned);
  };

  /* ---------------- RESET ---------------- */
  const handleReset = () => {
    setSelectedFilters({});
    setFilterOptions({});

    onSelectedSyslogFiltersChange({});
  };

  return (
    <div className="searchSyslogsContainer">

      <div className="searchSyslogsFilterEntries">

        {tagNames.map(tag => (
          <FilterSelect
            key={tag}
            label={tag}
            options={filterOptions[tag] || []}
            value={mapValuesToOptions(
              selectedFilters[tag],
              filterOptions[tag] || []
            )}
            loading={loadingField === tag}
            onChange={(v) => handleChange(v, tag)}
            onMenuOpen={() => loadOptions(tag)}
          />
        ))}

      </div>

      {/* ACTION BUTTONS */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          margin: "10px"
        }}
      >
        <button
          onClick={handleSearchClick}
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

/* ---------------- FILTER SELECT ---------------- */
const FilterSelect = ({
  label,
  options,
  value,
  onChange,
  loading,
  onMenuOpen
}) => (
  <div className="searchSyslogsFilterEntry">

    <span className="searchSignalFilterText">
      {label}:
    </span>

    <Select
      options={options}
      isMulti
      isLoading={loading}
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      onMenuOpen={onMenuOpen}
      styles={{
        ...customStyles("375px"),
        menuPortal: base => ({
          ...base,
          zIndex: 9999
        })
      }}
      menuPortalTarget={document.body}
      placeholder={`Select ${label}`}
      noOptionsMessage={() =>
        loading
          ? "Loading..."
          : "Click to load options"
      }
    />

  </div>
);

export default SyslogSignalFilters;
