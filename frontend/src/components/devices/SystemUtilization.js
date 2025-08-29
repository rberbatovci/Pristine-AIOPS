import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function SystemUtilization({ selectedDevice, onSuccess }) {
    const [device, setDevice] = useState(selectedDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [cpuStatus, setCpuStatus] = useState([]);
    const [memoryStatus, setMemoryStatus] = useState([]);
    const [cpuLoading, setCpuLoading] = useState(false);
    const [memoryLoading, setMemoryLoading] = useState(false);

    // Sync state when selectedDevice changes
    useEffect(() => {
        setDevice(selectedDevice);
    }, [selectedDevice]);

    // Configure syslogs
    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(`/devices/${device.hostname}/config/syslogs/`, {});

            setDevice(prev => ({
                ...prev,
                features: { ...prev.features, syslogs: true }
            }));

            if (onSuccess) onSuccess(response.data);
        } catch (err) {
            console.error('Syslog config failed:', err);
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch CPU status
    const getCpuStatus = async () => {
        setCpuLoading(true);
        setError('');
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/status/cpu/`);
            setCpuStatus(response.data.cpu || []);
        } catch (err) {
            console.error('CPU fetch failed:', err);
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally {
            setCpuLoading(false);
        }
    };

    // Fetch Memory status
    const getMemoryStatus = async () => {
        setMemoryLoading(true);
        setError('');
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/status/memory/`);
            setMemoryStatus(response.data.memory || []);
        } catch (err) {
            console.error('Memory fetch failed:', err);
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally {
            setMemoryLoading(false);
        }
    };

    useEffect(() => {
        if (device?.hostname) {
            getCpuStatus();
            getMemoryStatus();
        }
    }, [device]);

    return (
        <div className="signalRightElementContainer" style={{ maxHeight: '215px' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt">System Utilization</h2>
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

                <div style={{ marginTop: '10px' }}>
                    <h4>CPU Status:</h4>
                    {cpuLoading ? 'Loading...' : JSON.stringify(cpuStatus)}

                    <h4>Memory Status:</h4>
                    {memoryLoading ? 'Loading...' : JSON.stringify(memoryStatus)}
                </div>
            </div>
        </div>
    );
}

export default SystemUtilization;
