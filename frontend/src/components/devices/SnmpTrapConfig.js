import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';

function SnmpTrapConfig({ hostname, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const sendConfig = async (config) => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(`/devices/${hostname}/traps-xe-config/`);
            if (onSuccess) onSuccess(response.data);
        } catch (error) {
            console.error('Syslog config failed:', error);
            if (error.response?.data?.detail) {
                setError(error.response.data.detail);
            } else {
                setError(error.message || 'Unknown error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        sendConfig();
    };

    const handleSkip = () => {
        sendConfig(false, null);
    };

    return (
        <div className="searchSyslogsContainer">
            <span className="searchSignalFilterText">Configure SNMP Traps</span>
            <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
            </div>

            <div style={{ marginTop: '1rem' }}>
                <button onClick={handleSkip} style={{ marginLeft: '1rem' }}>
                    Skip
                </button>
                <button onClick={handleSubmit}>Configure SNMP Traps</button>
            </div>
        </div>
    );
}

export default SnmpTrapConfig;
