import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function SnmpTrapConfig({ selectedDevice, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showData, setShowData] = useState(false);

    const sendConfig = async (config) => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(`/devices/${selectedDevice.hostname}/traps-xe-config/`);
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
        <div className={`signalRightElementContainer ${showData ? 'snmpTrapConfig' : 'collapsed'}`} style={{ maxHeight: '350px' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
                    {showData ? '\u25CF' : '\u25CB'} SNMP Traps
                </h2>
                {!selectedDevice?.features?.snmp_traps && (
                    <div className="zoom-buttons-container">
                        <div className="headerButtons">

                            {loading ? (
                                <button disabled={loading} >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <TailSpin
                                            height="20"
                                            width="20"
                                            color="#ffffff"
                                            ariaLabel="loading"
                                        />
                                        <span>Configuring...</span>
                                    </div>
                                </button>
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
            {showData && (
                <div style={{ padding: '8px', marginLeft: '15px' }}>
                    {/* Status message */}
                    {selectedDevice?.features?.snmp_traps ? (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            SNMP Traps are already configured on this device.
                        </div>
                    ) : (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            Please configure SNMP Traps on the device.
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

export default SnmpTrapConfig;
