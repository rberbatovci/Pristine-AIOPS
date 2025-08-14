import { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function SnmpTrapConfig({ selectedDevice: initialDevice, onSuccess }) {
    const [device, setDevice] = useState(initialDevice); // Local copy for updates
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getTrapEndpoint = () => {
        if (!device.version) {
            throw new Error('Device version not provided');
        }
        if (device.version === 'ios-xe') {
            return `/devices/${device.hostname}/traps-xe-config/`;
        }
        if (device.version === 'ios-xr') {
            return `/devices/${device.hostname}/traps-xr-config/`;
        }
        throw new Error(`Unsupported device version: ${device.version}`);
    };

    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(getTrapEndpoint(), {});

            // ✅ Update local state so UI reflects SNMP traps are now configured
            setDevice(prev => ({
                ...prev,
                features: { ...prev.features, snmp_traps: true }
            }));

            if (onSuccess) onSuccess(response.data);
        } catch (error) {
            console.error('SNMP trap config failed:', error);
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
        <div className="signalRightElementContainer" style={{ maxHeight: '350px' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt">SNMP Traps</h2>
                {!device?.features?.snmp_traps && (
                    <div className="zoom-buttons-container">
                        <div className="headerButtons">
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TailSpin height="20" width="20" color="#ffffff" ariaLabel="loading" />
                                </div>
                            ) : (
                                <button onClick={sendConfig} className="iconButton">
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
                        Configuring SNMP Traps<span className="dot-flash">...</span>
                    </div>
                ) : device?.features?.snmp_traps ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        SNMP Traps are already configured on this device.
                    </div>
                ) : (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Please configure SNMP Traps on the device.
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

export default SnmpTrapConfig;
