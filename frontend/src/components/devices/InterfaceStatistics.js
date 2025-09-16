import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function InterfaceStatistics({ selectedDevice, onSuccess }) {
    const [device, setDevice] = useState(selectedDevice);
    const [interfaces, setInterfaces] = useState([]);
    const [interfacesLoading, setInterfacesLoading] = useState(false);
    const [error, setError] = useState('');

    const pushConfiguration = () => async () => {
        if (!selectedDevice?.hostname) {
            console.error("No device selected");
            return;
        }

        try {
            const response = await apiClient.post(
                `/devices/${selectedDevice.hostname}/configure/interface_stats/`,
                {}
            );
            console.log("Updated device:", response.data);
        } catch (err) {
            console.error("Request error:", err);
            const message = err.response?.data?.detail || err.message || err;
            alert(`Error configuring Interface Statistics: ${message}`);
        }
    };

    useEffect(() => {
        const fetchInterfaces = async () => {
            if (!selectedDevice?.hostname) {
                setInterfaces([]);
                return;
            }

            setInterfacesLoading(true);
            setError('');

            try {
                const response = await apiClient.get(`/devices/${selectedDevice.hostname}/status/last/interfaces/`);
                // Expected response: { "GigabitEthernet1": {...}, "Loopback0": {...}, ... }
                const data = response.data;

                // Convert object to array of interfaces for the table
                const interfacesArray = Object.entries(data).map(([name, stats]) => ({
                    name,
                    'status': stats['status'] ?? '',
                    'rx_kbps': stats['rx-kbps'] ?? '',
                    'rx_pps': stats['rx-pps'] ?? '',
                    'tx_kbps': stats['tx-kbps'] ?? '',
                    'tx_pps': stats['tx-pps'] ?? '',
                }));

                setInterfaces(interfacesArray);
            } catch (err) {
                console.error("Error fetching interfaces:", err);
                const message = err.response?.data?.detail || err.message || err;
                setError(message);
                setInterfaces([]);
            } finally {
                setInterfacesLoading(false);
            }
        };

        fetchInterfaces();
    }, [selectedDevice]);

    // Add empty rows if less than 6
    const displayedInterfaces = [...interfaces];
    const emptyRowsCount = Math.max(0, 6 - displayedInterfaces.length);
    for (let i = 0; i < emptyRowsCount; i++) {
        displayedInterfaces.push({ name: '', 'admin-status': '', 'oper-status': '' });
    }

        return (
        <div className="signalRightElementContainer" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt">Interface Statistics</h2>
            </div>

            <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.9' }}>
                {error && (
                    <div style={{ color: 'red', marginBottom: '10px' }}>
                        {typeof error === 'string' ? error : JSON.stringify(error)}
                    </div>
                )}

                {interfacesLoading ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>Loading interfaces...</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                                <th style={{ padding: '10px 12px' }}>Interface</th>
                                <th style={{ padding: '10px 12px' }}>Oper Status</th>
                                <th style={{ padding: '10px 12px' }}>Rx</th>
                                <th style={{ padding: '10px 12px' }}>Tx</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedInterfaces.map((intf, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #eee', height: '36px' }}>
                                    <td style={{ padding: '8px 10px' }}>{intf.name}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf.status}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf.rx_kbps}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf.rx_pps}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf.tx_kbps}</td>
                                    <td style={{ padding: '8px 10px' }}>{intf.tx_pps}</td>
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
