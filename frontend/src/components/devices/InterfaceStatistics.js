import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function InterfaceStatistics({ selectedDevice, onSuccess }) {
    const [device, setDevice] = useState(selectedDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [interfaces, setInterfaces] = useState([]);
    const [interfacesLoading, setInterfacesLoading] = useState(false);

    // Sync state when selectedDevice changes
    useEffect(() => {
        setDevice(selectedDevice);
        if (selectedDevice?.hostname) {
            getInterfacesStatus(selectedDevice.hostname);
        }
    }, [selectedDevice]);

    const getSyslogEndpoint = () => {
        if (!device?.version) throw new Error('Device version not provided');
        if (device.version === 'ios-xe') return `/devices/${device.hostname}/syslogs-xe-config/`;
        if (device.version === 'ios-xr') return `/devices/${device.hostname}/syslogs-xr-config/`;
        throw new Error(`Unsupported device version: ${device.version}`);
    };

    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(getSyslogEndpoint(), {});
            setDevice(prev => ({
                ...prev,
                features: { ...prev.features, syslogs: true }
            }));
            if (onSuccess) onSuccess(response.data);
        } catch (error) {
            console.error('Syslog config failed:', error);
            setError(error.response?.data?.detail || error.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const getInterfacesStatus = async (hostname) => {
        setInterfacesLoading(true);
        setError('');
        try {
            const response = await apiClient.get(`/devices/${hostname}/status/live/interfaces/`);

            // Drill down to actual interface list
            const intfs =
                response.data.interfaces?.["ietf-interfaces:interfaces-state"]?.interface || [];

            setInterfaces(intfs);
        } catch (err) {
            console.error('Interfaces fetch failed:', err);
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally {
            setInterfacesLoading(false);
        }
    };

    return (
        <div className="signalRightElementContainer" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt">Interface Statistics</h2>
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

            <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.9' }}>
                {error && (
                    <div style={{ color: 'red', marginBottom: '10px' }}>
                        {typeof error === 'string' ? error : JSON.stringify(error)}
                    </div>
                )}

                {interfacesLoading ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Loading interfaces...
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                                <th style={{ padding: '10px 12px' }}>Interface</th>
                                <th style={{ padding: '10px 12px' }}>Admin Status</th>
                                <th style={{ padding: '10px 12px' }}>Oper Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {interfaces.map((intf, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '8px 10px' }}>{intf.name}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf['admin-status']}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf['oper-status']}</td>
                                </tr>
                            ))}
                        </tbody>

                    </table>
                )}
            </div>
        </div>
    );
}

export default InterfaceStatistics;
