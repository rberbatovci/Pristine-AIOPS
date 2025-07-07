import React, { useState } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';

function SyslogConfig({ hostname, version, onSuccess }) {
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

    // Determine correct endpoint
    const getSyslogEndpoint = () => {
        if (!version) {
            throw new Error('Device version not provided');
        }
        if (version === 'ios-xe') {
            return `/devices/${hostname}/syslogs-xe-config/`;
        }
        if (version === 'ios-xr') {
            return `/devices/${hostname}/syslogs-xr-config/`;
        }
        throw new Error(`Unsupported device version: ${version}`);
    };

    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(getSyslogEndpoint(), {
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

    const handleSkip = () => {
        onSuccess && onSuccess(null);  // Let parent handle skipping
    };

    return (
        <div className="searchSyslogsContainer" style={{color: 'var(--spanTextColor)'}}>
            <span className="searchSignalFilterText">Configure syslogs</span>
            <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Minimum Severity:</span>
                    <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                        <Select
                            placeholder="Minimal Severity"
                            options={severityOptions}
                            value={severity}
                            onChange={setSeverity}
                            styles={customStyles('300px')}
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            menuShouldBlockScroll={true}
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div style={{ color: 'red', marginTop: '10px' }}>
                    {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
            )}

            <div style={{ marginTop: '1rem', right: '10px' }}>

                <button onClick={sendConfig} disabled={loading} className="buttonStyles addRuleButton">
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TailSpin
                                height="20"
                                width="20"
                                color="#ffffff"
                                ariaLabel="loading"
                            />
                            <span>Configuring...</span>
                        </div>
                    ) : (
                        'Configure Netflow'
                    )}
                </button>
            </div>
        </div>
    );
}

export default SyslogConfig;
