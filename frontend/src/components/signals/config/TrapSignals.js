import React, { useState, useEffect } from 'react';
import StatefulTraps from './StatefulTraps';
import apiClient from '../../misc/AxiosConfig';
import './SignalConfigElement.css'; // Import the CSS file for styling

const ConfigDashboard = () => {
    const options = [
        { label: 'Stateful SNMP Traps', value: 'snmpTraps' },
    ];

    const [selectedSignalConfigElement, setSelectedSignalConfigElement] = useState(options[0]);
    const [hostnames, setHostnames] = useState([]);
    const [devices, setDevices] = useState([]);
    const [isAddingNewRule, setIsAddingNewRule] = useState(true);

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
        snmpTraps: <StatefulTraps devices={devices} />,
    };

    return (
        <div className="dropdownConfigContainer">
            <div className="signalTagContainer">
            </div>
            <div style={{ borderRadius: '12px' }}>
                {selectedSignalConfigElement && contentMap[selectedSignalConfigElement.value]}
            </div>
        </div>
    );
};

export default ConfigDashboard;
