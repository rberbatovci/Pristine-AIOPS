import React, { useState } from "react";
import Select from "react-select";
import customStyles from "../../misc/SelectStyles";
import "../../../css/SearchElement.css";

import { useTrapSignalsTagOptions } from "../../../hooks/useTrapSignalsTagOptions";

const STATIC_ENTITIES = ["snmpTrapOid", "rule"];

const TrapSignalFilters = ({
    onSelectedSyslogFiltersChange,
    initialSelectedTags = {},
    snmpTrapTags = [],
}) => {
    const [selectedTags, setSelectedTags] = useState(initialSelectedTags);

    const {
        options,
        loading,
        fetchOptions
    } = useTrapSignalsTagOptions();

    const handleChange = (values, name) => {
        const updated = { ...selectedTags, [name]: values };
        setSelectedTags(updated);
        onSelectedSyslogFiltersChange(updated);
    };

    const renderSelect = (name, label) => (
        <div className="searchSyslogsFilterEntry" key={name}>
            <span className="searchSignalFilterText">{label}:</span>
            <div style={{ marginTop: "6px" }}>
                <Select
                    isMulti
                    name={name}
                    options={options[name] || []}
                    value={selectedTags[name] || []}
                    onChange={(v) => handleChange(v, name)}
                    onFocus={() => fetchOptions(name)}
                    isLoading={loading[name]}
                    styles={customStyles("370px")}
                />
            </div>
        </div>
    );

    return (
        <div
            className="dropdownConfigContainer"
            style={{ padding: "10px", width: "400px" }}
        >
            <span>Filter SNMP Trap Signals:</span>

            <div className="searchSyslogsFilterEntries" style={{ marginTop: "8px" }}>
                {renderSelect("snmpTrapOid", "SNMP Trap OID")}
                {renderSelect("rule", "Stateful Rule")}

                {snmpTrapTags.map(tag =>
                    renderSelect(tag.name, tag.name)
                )}
            </div>
        </div>
    );
};

export default TrapSignalFilters;