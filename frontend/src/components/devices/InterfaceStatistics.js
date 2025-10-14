import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function InterfaceStatistics({ selectedDevice, onSuccess, showNotification }) {
    const [device, setDevice] = useState(selectedDevice);
    const [interfaces, setInterfaces] = useState([]);
    const [interfacesLoading, setInterfacesLoading] = useState(false);
    const [error, setError] = useState('');

    const pushConfiguration = () => async () => {
        if (!selectedDevice?.hostname) {
            console.error("No device selected");
            return;
        }
        showNotification(`Configuring interface statistics telemetry on ${selectedDevice.hostname}...`, "loading");
        try {
            const response = await apiClient.post(
                `/devices/${selectedDevice.hostname}/configure/interface_stats/`,
                {}
            );
            showNotification(`Interface statistics telemetry applied successfully on ${selectedDevice.hostname}`, "success");
        } catch (err) {
            showNotification(`Failed to apply interface statistics telemetry on ${selectedDevice.hostname}`, "error");
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
                <div className="zoom-buttons-container">
                    <div className="headerButtons">
                        <button
                            className={`iconButton ${selectedDevice.features?.telemetry?.interface_stats ? 'active' : ''}`}
                            onClick={pushConfiguration()}>
                            <IoPushOutline className="defaultIcon" />
                            <IoPushSharp className="hoverIcon" />
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.9' }}>
                {selectedDevice?.features?.telemetry?.system_util ? (
          <>
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
                            {interfaces
                                .filter(intf => intf.name && intf.name.trim() !== "") // 🔹 remove blank interface rows
                                .map((intf, idx) => {
                                    const isReady = intf.status?.toLowerCase() === "if-oper-state-ready";

                                    return (
                                        <tr
                                            key={idx}
                                            style={{
                                                borderBottom: "1px solid #eee",
                                                height: "42px",
                                                transition: "background 0.2s ease-in-out",
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                        >
                                            

                                            {/* Oper Status Badge */}
                                            <td style={{ padding: "8px 10px" }}>
                                                <span
                                                    style={{
                                                        display: "inline-block",
                                                        padding: "4px 10px",
                                                        borderRadius: "20px",
                                                        fontSize: "12px",
                                                        fontWeight: "600",
                                                        color: "white",
                                                        backgroundColor: isReady ? "#4CAF50" : "#E74C3C",
                                                        boxShadow: isReady
                                                            ? "0 0 8px rgba(76,175,80,0.6)"
                                                            : "0 0 8px rgba(231,76,60,0.6)",
                                                        transition: "transform 0.2s",
                                                    }}
                                                >
                                                    {isReady ? "READY" : "DOWN"}
                                                </span>
                                            </td>
                                            {/* Interface Name */}
                                            <td style={{ padding: "8px 10px", fontWeight: "500" }}>
                                                {intf.name}
                                            </td>

                                            {/* Rx/Tx columns */}
                                            <td style={{ padding: "8px 10px" }}>{intf.rx_kbps || "--"} kbps</td>
                                            <td style={{ padding: "8px 10px" }}>{intf.rx_pps || "--"} pps</td>
                                            <td style={{ padding: "8px 10px" }}>{intf.tx_kbps || "--"} kbps</td>
                                            <td style={{ padding: "8px 10px" }}>{intf.tx_pps || "--"} pps</td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                )}
            </>
                ) : (
                    <div style={{ padding: "10px", color: "gray" }}>
                        Interface statistics telemetry not enabled for this device.
                    </div>
                )}
            </div>
        </div>
    );
}

export default InterfaceStatistics;
