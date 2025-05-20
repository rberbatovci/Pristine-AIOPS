import React, { useState, useEffect } from 'react';
import StatefulSyslogs from './StatefulSyslogs';
import SyslogMnemonicUpdater from './SyslogMnemonic';
import SyslogSeverity from './SyslogSeverity';
import apiClient from '../../misc/AxiosConfig';
import './SignalConfigElement.css';

const SyslogSignalsConfig = () => {
    const options = [
        { label: 'Syslog Severity', value: 'syslogSeverity' },
        { label: 'Syslog Mnemonic', value: 'syslogMnemonic' },
        { label: 'Stateful Syslogs', value: 'syslogs' },
    ];

    const [selectedSignalConfigElement, setSelectedSignalConfigElement] = useState(options[0]);
    const [hostnames, setHostnames] = useState([]);
    const [devices, setDevices] = useState([]);
    const [mnemonics, setMnemonics] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);


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

        const fetchMnemonics = async () => {
            setIsLoading(true); // Start loading
            setError(null); // Reset error
            try {
                const response = await apiClient.get('/syslogs/mnemonics/');
                const mnemonicsData = response.data;

                // Transform data: Set 'id' as value and 'name' as label
                const formattedMnemonics = mnemonicsData.map(mnemonic => ({
                    value: mnemonic.name,
                    label: mnemonic.name,
                    name: mnemonic.name
                }));

                setMnemonics(formattedMnemonics);
            } catch (error) {
                console.error('Error fetching mnemonics in StatefulSyslogs:', error);
                setError('Failed to load mnemonics. Please try again later.');
            } finally {
                setIsLoading(false); // End loading
            }
        };

        fetchHostnames();
        fetchMnemonics();
    }, []);



    const handleOptionChange = (option) => {
        setSelectedSignalConfigElement(option);
    };

    const contentMap = {
        syslogSeverity: <SyslogSeverity />,
        syslogs: <StatefulSyslogs devices={devices} mnemonics={mnemonics} />,
        syslogMnemonic: <SyslogMnemonicUpdater mnemonics={mnemonics} />,
    };

    return (
        <div className="dropdownConfigContainer">
            <div>
                <SyslogSeverity />
            </div>
            <div><StatefulSyslogs devices={devices} mnemonics={mnemonics} /></div>

        </div>
    );
};

export default SyslogSignalsConfig;
