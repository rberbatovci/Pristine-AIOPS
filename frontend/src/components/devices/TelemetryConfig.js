import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import '../../css/SyslogTagsList.css';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

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
    const [currentLoadingLabel, setCurrentLoadingLabel] = useState('');

    const sendTelemetryConfig = async (type, label) => {
        setLoadingState(prev => ({ ...prev, [type]: true }));
        setCurrentLoadingLabel(label);
        try {
            const res = await apiClient.post(`/devices/${selectedDevice.hostname}/xe/configure/${type}/`, {
                receiver_ip: '10.0.0.1',
                receiver_port: 57500
            });
            if (onSuccess) onSuccess(res.data);
        } catch (err) {
            console.error(`Error configuring ${type}:`, err);
        } finally {
            setLoadingState(prev => ({ ...prev, [type]: false }));
            setCurrentLoadingLabel('');
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
                        <li key={key} className="telemetryFeatureItem">
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--textColor)', fontSize: '14px' }}>
                                    <input
                                        type="checkbox"
                                        readOnly
                                        checked={telemetryFeatures?.[key] || false}
                                        style={{ marginRight: '6px', accentColor: '#2196f3' }}
                                    />
                                    <span style={{ paddingLeft: '8px' }}>
                                        {currentLoadingLabel === label ? (
                                            <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                                                Configuring {label} <span className="dot-flash">...</span>
                                            </span>
                                        ) : (
                                            <span style={{ marginLeft: '8px' }}>{label}</span>
                                        )}
                                    </span>
                                </div>
                                {!telemetryFeatures?.[key] && (
                                    <div className="headerButtons">
                                        {!telemetryFeatures?.[key] && (
                                            <div className="headerButtons">
                                                {loadingState[apiType] ? (
                                                    <TailSpin height="20" width="20" color="#ffffff" ariaLabel="loading" />
                                                ) : (
                                                    <button className="iconButton" onClick={() => sendTelemetryConfig(apiType, label)}>
                                                        <IoPushOutline className="defaultIcon" />
                                                        <IoPushSharp className="hoverIcon" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
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
