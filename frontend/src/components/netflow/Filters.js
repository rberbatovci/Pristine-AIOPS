import { useState, useCallback } from "react";
import Select from "react-select";
import customStyles from "../misc/SelectStyles";
import "../../css/SearchElement.css";
import { useFilterOptions } from "../../hooks/useFilterOptions"; 

const NETFLOW_FIELD_MAP = {
  "Device": "device",
  "Protocol": "protocol",
  "Source IP": "source_ip",
  "Source Port": "source_port",
  "Destination IP": "dest_ip",
  "Destination Port": "dest_port",
  "Input Interface": "input_if",
  "Output Interface": "output_if"
}; 

const filterFields = [
  "Device",
  "Protocol",
  "Source IP",
  "Source Port",
  "Destination IP",
  "Destination Port",
  "Input Interface",
  "Output Interface"
];


const FilterTraffic = ({
  keycloak,
  onSelectedTrafficFiltersChange
}) => {

  const [selectedFilters, setSelectedFilters] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [loadingField, setLoadingField] = useState(null); 
  const { getOptions } = useFilterOptions(keycloak);  
  const handleChange = (values, key) => { 
    const safeValues = Array.isArray(values)
      ? values.map(v => v.value)
      : []; 
    setSelectedFilters(prev => ({
      ...prev,
      [key]: safeValues
    }));
  }; 

  const mapValuesToOptions = (
    values = [],
    options = []
  ) => {

    if (!Array.isArray(values)) {
      return [];
    } 
    return values.map(value => { 
      const found = options.find(
        opt => String(opt.value) === String(value)
      ); 
      return found || {
        value,
        label: String(value)
      };
    });
  };
 

  const loadOptions = useCallback(
    async (field) => {
 
      if (filterOptions[field]) {
        return;
      } 

      const backendField =
        NETFLOW_FIELD_MAP[field];

      if (!backendField) { 
        console.error(
          `No NetFlow backend field mapping found for "${field}"`
        );

        return;
      } 
      setLoadingField(field);

      try { 

        const filters = {};

        Object.entries(selectedFilters)
          .forEach(([key, values]) => { 
            if (key === field) {
              return;
            } 
            if (
              !Array.isArray(values) ||
              values.length === 0
            ) {
              return;
            } 
            const backendKey =
              NETFLOW_FIELD_MAP[key]; 
            if (!backendKey) {
              return;
            } 
            filters[backendKey] = values;
          });


        console.log(
          "Loading NetFlow options:",
          {
            uiField: field,
            backendField,
            filters
          }
        );
  
        const options = await getOptions({
          resource: "netflow",
          field: backendField,
          filters
        });
 
        setFilterOptions(prev => ({
          ...prev,
          [field]: options
        }));

      }
      catch (err) { 
        console.error(
          "Failed loading NetFlow filter options:",
          err
        ); 
      }
      finally { 
        setLoadingField(null); 
      } 
    },
    [
      filterOptions,
      selectedFilters,
      getOptions
    ]
  );
 
  const handleSearchClick = () => { 
    const cleaned =
      Object.fromEntries(
        Object.entries(selectedFilters)
          .filter(
            ([, values]) =>
              Array.isArray(values) &&
              values.length > 0
          )
          .map(([key, values]) => { 
            const backendKey =
              NETFLOW_FIELD_MAP[key] || key; 
            return [
              backendKey,
              values
            ];
          })
      );


    console.log(
      "Sending NetFlow filters:",
      cleaned
    );


    onSelectedTrafficFiltersChange(
      cleaned
    );
  };
 
  const handleReset = () => { 
    setSelectedFilters({});
    setFilterOptions({}); 
    onSelectedTrafficFiltersChange({});
  };
 
  return (
    <div className="searchSyslogsContainer"> 
      <div className="searchSyslogsFilterEntries"> 
        {filterFields.map(field => ( 
          <FilterSelect
            key={field}
            label={field} 
            options={
              filterOptions[field] || []
            } 
            value={
              mapValuesToOptions(
                selectedFilters[field],
                filterOptions[field] || []
              )
            } 
            loading={
              loadingField === field
            } 
            onChange={
              values =>
                handleChange(
                  values,
                  field
                )
            } 
            onMenuOpen={
              () =>
                loadOptions(field)
            }
          /> 
        ))}

      </div>


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


// ============================================================
// FILTER SELECT
// ============================================================

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
      value={
        Array.isArray(value)
          ? value
          : []
      }
      onChange={onChange}
      onMenuOpen={onMenuOpen}

      styles={{
        ...customStyles("375px"),

        menuPortal: base => ({
          ...base,
          zIndex: 9999
        })
      }}

      menuPortalTarget={
        document.body
      }

      placeholder={
        `Select ${label}`
      }

      noOptionsMessage={() =>
        loading
          ? "Loading..."
          : "Click to load options"
      }
    />

  </div>
);


export default FilterTraffic;