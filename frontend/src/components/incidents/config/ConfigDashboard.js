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

    useEffect(() => {
        const fetchHostnames = async () => {
            try {
                const response = await apiClient.get('/devices/devices/');
                const hostnames = response.data.map((device) => ({
                    id: device.id,
                    hostname: device.hostname,
                    ip_address: device.ip_address,
                    label: device.hostname,
                }));
                setDevices(hostnames);
            } catch (error) {
                console.error('Error fetching agent data:', error);
            }
        };

        fetchHostnames();
    }, []);

    const handleOptionChange = (option) => {
        setSelectedSignalConfigElement(option);
    };

    const contentMap = {
        mappingSignals: <MappingSignals devices={devices}/>,
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
