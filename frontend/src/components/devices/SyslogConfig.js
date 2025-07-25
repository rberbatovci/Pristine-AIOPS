import React, { useState } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function SyslogConfig({ selectedDevice, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showData, setShowData] = useState(false);

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

    console.log('Selected Device:', selectedDevice);

    // Determine correct endpoint
    const getSyslogEndpoint = () => {
        if (!selectedDevice.version) {
            throw new Error('Device version not provided');
        }
        if (selectedDevice.version === 'ios-xe') {
            return `/devices/${selectedDevice.hostname}/syslogs-xe-config/`;
        }
        if (selectedDevice.version === 'ios-xr') {
            return `/devices/${selectedDevice.hostname}/syslogs-xr-config/`;
        }
        throw new Error(`Unsupported device version: ${selectedDevice.version}`);
    };

    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(getSyslogEndpoint(), {});

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
        <div className={`signalRightElementContainer ${showData ? 'syslogConfig' : 'collapsed'}`} style={{ maxHeight: '215px' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
                    {showData ? '\u25CF' : '\u25CB'} Syslogs
                </h2>
                {!selectedDevice?.features?.syslogs && (
                    <div className="zoom-buttons-container">
                        <div className="headerButtons">

                            {loading ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TailSpin
                                            height="20"
                                            width="20"
                                            color="#ffffff"
                                            ariaLabel="loading"
                                        />
                                    </div>
                            ) : (
                                <button className="iconButton" onClick={sendConfig}>
                                    <IoPushOutline className="defaultIcon" />
                                    <IoPushSharp className="hoverIcon" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {showData && (
                <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.8' }}>
                    {loading ? (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            Configuring syslogs<span className="dot-flash">...</span>
                        </div>
                    ) : selectedDevice?.features?.syslogs ? (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            Syslogs are already configured on this device.
                        </div>
                    ) : (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            Please configure syslogs on the device.
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div style={{ color: 'red', marginTop: '10px' }}>
                            {typeof error === 'string' ? error : JSON.stringify(error)}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}

export default SyslogConfig;
