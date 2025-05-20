import React, { useState, useEffect } from "react";
import Signals from "./Signals";
import Traps from "./Traps";
import Syslogs from "./Syslogs";

const FilterDashboard = ({ onSearch }) => {
    const [selectedOption, setSelectedOption] = useState({ label: "Signals", value: "signal" });
    const [selectedSNMPTraps, setSelectedSNMPTraps] = useState([]);
    const [selectedSignalFilters, setSelectedSignalFilters] = useState({
        hostname: [],
        state: [],
        severity: [],
    });
    const [selectedSyslogFilters, setSelectedSyslogFilters] = useState([]);
    const [selectedTrapFilters, setSelectedTrapFilters] = useState([]);
    const [selectedSyslogTags, setSelectedSyslogTags] = useState({});
    const [selectedTimeRange, setSelectedTimeRange] = useState({
        startDate: null,
        endDate: null,
    });

    const handleSearchClick = () => {
        const filters = {
            syslogTags: selectedSyslogTags,
            snmpTraps: selectedSNMPTraps,
            signals: selectedSignalFilters,
            timeRange: selectedTimeRange,
        };
        onSearch(filters); 
    };

    useEffect(() => {
        console.log("Updated selectedSignalFilters:", selectedSignalFilters);
    }, [selectedSignalFilters]);

    const handleSelectedSignals = (values) => {
        setSelectedSignalFilters(values);
    };


    const handleOptionChange = (option) => {
        console.log("Option selected:", option);
        setSelectedOption(option);
    };

    const contentMap = {
        signal: (
            <Signals
                onSearch={handleSelectedSignals}
            />
        ),
        syslogs: (
            <Syslogs
                onSelectedSyslogFiltersChange={(values) => setSelectedSyslogTags(values)}
                initialSelectedTags={selectedSyslogTags}
            />
        ),
        snmptraps: (
            <Traps
                onSelectedTrapsChange={(values) => setSelectedSNMPTraps(values)}
                initialSelectedTraps={selectedSNMPTraps}
            />
        ),
    };

    return (
        <div className="dropdownConfigContainer">
            <ul className="configMainList">
                {["Signal", "Syslogs", "snmpTraps"].map((label, index) => (
                    <li
                        key={index}
                        className={`configMainListButton ${selectedOption.value === label.toLowerCase() ? 'active' : ''}`}
                        onClick={() => handleOptionChange({ label, value: label.toLowerCase() })}
                    >
                        {label}
                    </li>
                ))}
            </ul>
            <div style={{ background: 'var(--backgroundColor3)', padding: '8px', margin: '10px', borderRadius: '8px' }}>
                {contentMap[selectedOption.value]}
            </div>
            <div className="signalConfigButtonContainer">
                <button onClick={handleSearchClick}>Search</button>
            </div>
        </div>
    );
};

export default FilterDashboard;
