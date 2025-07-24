import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import '../../css/SyslogTagsList.css';

const telemetryOptions = [
    { key: 'cpu_util', label: 'CPU utilization', apiType: 'cpu_util' },
    { key: 'memory_stats', label: 'Memory Statistics', apiType: 'memory_stats' },
    { key: 'interface_stats', label: 'Interface Statistics', apiType: 'interface_stats' },
    { key: 'bgp_connections', label: 'BGP Connections', apiType: 'bgp_connections' },
    { key: 'isis', label: 'ISIS Statistics', apiType: 'isis' }
];

function TelemetryConfig({ selectedDevice, version, telemetryFeatures, onSuccess }) {
    const [loadingState, setLoadingState] = useState({});
    const [showData, setShowData] = useState(false);
    
    const sendTelemetryConfig = async (type) => {
        setLoadingState(prev => ({ ...prev, [type]: true }));
        try {
            const res = await apiClient.post(`/devices/${selectedDevice.hostname}/xe/configure/${type}/`, {
                receiver_ip: '10.0.0.1',   // ← You can dynamically update this if needed
                receiver_port: 57500
            });
            if (onSuccess) onSuccess(res.data);
        } catch (err) {
            console.error(`Error configuring ${type}:`, err);
        } finally {
            setLoadingState(prev => ({ ...prev, [type]: false }));
        }
    };

    return (
        <div className={`signalRightElementContainer ${showData ? 'telemetryConfig' : 'collapsed'}`}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
                    {showData ? '\u25CF' : '\u25CB'} Model-Driven Telemetry
                </h2>
            </div>
            <div>
            <ul className="signalTagList">
                {telemetryOptions.map(({ key, label, apiType }) => (
                    <li key={key} className="signalTagItem">
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    readOnly
                                    checked={telemetryFeatures?.[key] || false}
                                    style={{ marginRight: '6px', accentColor: '#2196f3' }}
                                />
                                <span style={{ paddingLeft: '8px' }}>{label}</span>
                            </div>
                            {!telemetryFeatures?.[key] && (
                                <button
                                    onClick={() => sendTelemetryConfig(apiType)}
                                    disabled={loadingState[apiType]}
                                    style={{
                                        marginLeft: '10px',
                                        padding: '4px 8px',
                                        backgroundColor: '#2196f3',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {loadingState[apiType] ? <TailSpin height={16} width={16} color="#fff" /> : 'Enable'}
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
            </div>
        </div>
    );
}

export default TelemetryConfig;
