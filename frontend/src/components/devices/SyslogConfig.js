import { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function SyslogConfig({ selectedDevice: initialDevice, onSuccess }) {
    const [device, setDevice] = useState(initialDevice); // local state for updates
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getSyslogEndpoint = () => {
        if (!device.version) {
            throw new Error('Device version not provided');
        }
        if (device.version === 'ios-xe') {
            return `/devices/${device.hostname}/syslogs-xe-config/`;
        }
        if (device.version === 'ios-xr') {
            return `/devices/${device.hostname}/syslogs-xr-config/`;
        }
        throw new Error(`Unsupported device version: ${device.version}`);
    };

    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(getSyslogEndpoint(), {});

            // ✅ Update local state to reflect syslogs are now configured
            setDevice(prev => ({
                ...prev,
                features: { ...prev.features, syslogs: true }
            }));

            // Notify parent if needed
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

    return (
        <div className="signalRightElementContainer" style={{ maxHeight: '215px' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt">Syslogs</h2>
                {!device?.features?.syslogs && (
                    <div className="zoom-buttons-container">
                        <div className="headerButtons">
                            {loading ? (
                                <TailSpin height="20" width="20" color="#ffffff" ariaLabel="loading" />
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
            <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.8' }}>
                {loading ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Configuring syslogs<span className="dot-flash">...</span>
                    </div>
                ) : device?.features?.syslogs ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Syslogs are already configured on this device.
                    </div>
                ) : (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Please configure syslogs on the device.
                    </div>
                )}

                {error && (
                    <div style={{ color: 'red', marginTop: '10px' }}>
                        {typeof error === 'string' ? error : JSON.stringify(error)}
                    </div>
                )}
            </div>
        </div>
    );
}


export default SyslogConfig;
