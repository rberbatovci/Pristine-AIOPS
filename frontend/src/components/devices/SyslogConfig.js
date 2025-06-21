import React, { useState } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import apiClient from '../misc/AxiosConfig';

function SyslogConfig({ hostname, onSuccess }) {
    const [severity, setSeverity] = useState({ value: 'informational', label: '6 - Informational' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const severityOptions = [
        { value: 'emergencies', label: '0 - Emergency' },
        { value: 'alerts', label: '1 - Alert' },
        { value: 'critical', label: '2 - Critical' },
        { value: 'errors', label: '3 - Error' },
        { value: 'warnings', label: '4 - Warning' },
        { value: 'notifications', label: '5 - Notification' },
        { value: 'informational', label: '6 - Informational' },
        { value: 'debugging', label: '7 - Debugging' },
    ];

    const sendConfig = async (config) => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(`/devices/${hostname}/syslog-config/`, {
                severity: severity.value,
            });

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
        sendConfig({ severity: severity.value });
    };

    const handleSkip = () => {
        sendConfig(false, null);
    };

    return (
        <div className="searchSyslogsContainer">
            <span className="searchSignalFilterText">Configure syslogs</span>
            <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Minimum Severity:</span>
                    <div style={{ marginTop: '6px' }}>
                        <Select
                            placeholder="Minimal Severity"
                            options={severityOptions}
                            value={severity}
                            onChange={setSeverity}
                            styles={customStyles('300px')}
                        />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
                <button onClick={handleSkip} style={{ marginLeft: '1rem' }}>
                    Skip
                </button>
                <button onClick={handleSubmit}>Configure Syslogs</button>
            </div>
        </div>
    );
}

export default SyslogConfig;
