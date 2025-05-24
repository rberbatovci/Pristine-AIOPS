import React, { useState, useEffect } from 'react';
import MappingSignals from './MappingSignals';
import apiClient from '../../misc/AxiosConfig';
import './SignalConfigElement.css';


const ConfigDashboard = () => {
    const options = [
        { label: 'Mapping Signals', value: 'mappingSignals' },
    ];

    const [selectedSignalConfigElement, setSelectedSignalConfigElement] = useState(options[0]);
    const [hostnames, setHostnames] = useState([]);
    const [devices, setDevices] = useState([]);

    

    const handleOptionChange = (option) => {
        setSelectedSignalConfigElement(option);
    };

    const contentMap = {
        mappingSignals: <MappingSignals devices={devices} />,
    };

    return (
        <div className="dropdownConfigContainer">
            <div>
                <ul className="configMainList">
                    {options.map((option) => (
                        <li
                            key={option.value}
                            className={`configMainListButton ${selectedSignalConfigElement && selectedSignalConfigElement.value === option.value ? 'active' : ''}`}
                            onClick={() => handleOptionChange(option)}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            </div>
            <div style={{ borderRadius: '12px' }}>
                {selectedSignalConfigElement && contentMap[selectedSignalConfigElement.value]}
            </div>
        </div>
    );
};

export default ConfigDashboard;
