import React, { useState, useEffect, useRef } from 'react';
import '../css/Devices.css';
import List from '../components/devices/List';
import InterfaceStatistics from '../components/devices/InterfaceStatistics';
import SystemUtilization from '../components/devices/SystemUtilization';
import Info from '../components/devices/Info';
import DeviceWarning from '../components/devices/DeviceWarning';
import kcFetch from '../components/misc/kcFetch';
import useDevices from '../hooks/useDevices';
import useNetworkScan from '../hooks/useNetworkScan';
import useDeviceDeepScan from '../hooks/useDeviceDeepScan';
import { useDevicePing } from '../hooks/useDevicePing';

function Devices({
    currentUser,
    setDashboardTitle,
    showNotification,
    keycloak,
    selectedDevice,
    setSelectedDevice,
    devicesRefreshKey,
    searchEvent
}) {
    const socketRef = useRef(null);
    const [showComponents, setShowComponents] = useState(false);
    const { devices: onboardedDevices, loading: hookLoading, reload: fetchDevices } = useDevices(keycloak);
    const [devicesState, setDevicesState] = useState([]);
    const {
        scanNetwork,
        devices: discoveredDevices,
        loading: sweepLoading
    } = useNetworkScan(keycloak, showNotification);

    const {
        deepScanDevice,
        loading: deepScanLoading
    } = useDeviceDeepScan(keycloak);

    const {
        data: devicesPing,
        loading: pingLoading,
        error: pingError,
        reload: reloadPing,
    } = useDevicePing(
        keycloak,
        devicesState,
        true,
        10000
    );

    useEffect(() => {
        setSelectedDevice(null);
    }, []);

    useEffect(() => {
        setDashboardTitle("Devices Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    useEffect(() => {
        fetchDevices();
        handleDeviceSelect(selectedDevice);
    }, [devicesRefreshKey, fetchDevices]);

    useEffect(() => {
        if (onboardedDevices?.length) {
            setDevicesState(onboardedDevices);
        }
    }, [onboardedDevices]);

    useEffect(() => {
        if (!searchEvent) return;
        if (searchEvent.type === 'network') {
            scanNetwork(searchEvent.value).catch((err) => {
                console.error("Scan failed:", err);
                showNotification?.("Network scan failed", "error");
            });
        }
        if (searchEvent.type === 'deepScan' && selectedDevice) {
            console.log("Initiating deep scan for device:", selectedDevice);
            handleDeepScan(selectedDevice).catch((err) => {
                console.error("Deep scan failed:", err);
                showNotification?.("Deep scan failed", "error");
            });
            console.log("Deep scan initiated for device:", selectedDevice);
        }
    }, [searchEvent]);

    const isSameDevice = (a, b) => {
        if (!a || !b) return false;

        return (
            (a.hostname || "").toLowerCase() === (b.hostname || "").toLowerCase() ||
            (a.ip_address || a.ip) === (b.ip_address || b.ip)
        );
    };

    const updateDevice = (update) => {
        // Update device list
        setDevicesState(prev =>
            prev.map(device =>
                isSameDevice(device, update)
                    ? { ...device, ...update }
                    : device
            )
        );

        // Update currently selected device
        setSelectedDevice(prev => {
            if (!prev) return prev;

            if (!isSameDevice(prev, update)) {
                return prev;
            }

            return {
                ...prev,
                ...update
            };
        });
    };

    const updateDeviceList = (msg) => {
        setDevicesState((prev) =>
            prev.map((device) => {
                const match =
                    (device.hostname ?? "").toLowerCase() === (msg.hostname ?? "").toLowerCase() ||
                    device.ip_address === msg.ip_address;

                if (!match) return device;

                return {
                    ...device,
                    status: msg.status ?? device.status,
                };
            })
        );
    };

    const handlePingUpdate = (msg) => {
        updateDevice({
            hostname: msg.hostname,
            ip_address: msg.ip_address || msg.ip,
            status: msg.status,
            rtt_ms: msg.rtt_ms,
            timestamp: msg.timestamp
        });
    };

    useEffect(() => {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${window.location.host}/ws/ping`);

        socketRef.current = ws;

        ws.onopen = () => {
            console.log("🔌 WebSocket connected");
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);

                switch (msg.type) {

                    case "icmp_ping":
                        handlePingUpdate(msg);
                        break;

                    case "device_update":
                        updateDevice(msg);
                        break;

                    case "cpu_util":
                        updateDevice(msg);
                        break;

                    case "memory_util":
                        updateDevice(msg);
                        break;

                    default:
                        console.warn(msg);
                }
            } catch (err) {
                console.error("WS parse error:", err);
            }
        };

        ws.onerror = (err) => console.error("WebSocket error:", err);

        ws.onclose = () => {
            console.log("❌ WebSocket disconnected");
            socketRef.current = null;
        };

        return () => ws.close();
    }, []);

    const handleDeepScan = async (device) => {
        if (device.origin !== "discovered") return;

        showNotification?.(
            `Initiating deep scan for ${device.ip_address}`,
            "info"
        );

        try {
            const scanData = await deepScanDevice(device.ip_address);
            console.log("Deep scan results:", scanData.results);
            const deepScanUpdate = {
                ...device,
                ip_address: scanData.results.ip,
                state: scanData.results.state,
                os_match: scanData.results.os_match,
                protocols: scanData.results.protocols,
                tcp_ports:
                    scanData.results.protocols?.tcp || [],
                origin: "discovered",
                isDeepScanned: true
            };
            updateDevice(deepScanUpdate);
            setSelectedDevice(prev => ({
                ...prev,
                ...deepScanUpdate
            }));
            showNotification?.(
                "Deep scan completed",
                "success"
            );

        } catch (err) {
            console.error(err);
            showNotification?.(
                "Deep scan failed",
                "error"
            );
        }
    };

    const handleDeviceSelect = async (device) => {
        setShowComponents(true);

        if (device.origin === "discovered") {
            setSelectedDevice(device);
            return;
        }

        try {
            const data = await kcFetch(
                keycloak,
                `/devices/${device.hostname || device.ip_address}`
            );
            setSelectedDevice({
                ...data,
                origin: "onboarded"
            });
        } catch (err) {
            console.error(err);
            showNotification?.("Failed to load device", "error");
        }
    };

    const handleDeviceDeselect = () => {
        setSelectedDevice(null);
    };

    useEffect(() => {
        let timeout;
        if (selectedDevice) {
            timeout = setTimeout(() => setShowComponents(true), 300);
        } else {
            timeout = setTimeout(() => setShowComponents(false), 150);
        }
        return () => clearTimeout(timeout);
    }, [selectedDevice]);

    const isExpanded = !!selectedDevice;

    return (
        <div
            className="devices-container"
            style={{
                display: 'flex',
                width: isExpanded ? '80%' : '40%',
                transition: 'width 0.6s ease'
            }} >
            <div
                style={{
                    width: isExpanded ? '40%' : '100%',
                    transition: 'width 0.6s ease-in-out',
                    overflow: 'hidden',
                    height: 'calc(100vh - 50px)'
                }} >
                <div className="mainContainer" style={{ marginTop: '10px' }} >
                    <List
                        onboardedDevices={onboardedDevices || []}
                        discoveredDevices={discoveredDevices || []}
                        devicesPing={devicesPing || []}
                        loading={hookLoading || sweepLoading || deepScanLoading}
                        keycloak={keycloak}
                        onDeviceSelect={handleDeviceSelect}
                        searchEvent={searchEvent}
                    />
                </div>
            </div>
            <div
                className="right-column"
                style={{
                    width: isExpanded ? '60%' : '0',
                    transition: 'width 0.6s ease-in-out',
                    overflow: 'auto'
                }}  >
                <div className="right-content-wrapper">
                    <div className="right-content" style={{ margin: "10px" }}>
                        {showComponents && selectedDevice && (
                            <>
                                <Info
                                    selectedDevice={selectedDevice}
                                    onDeviceDeselect={handleDeviceDeselect}
                                    isScanning={deepScanLoading}
                                />
                                {selectedDevice.origin === "discovered" && (
                                    <DeviceWarning
                                        keycloak={keycloak}
                                        selectedDevice={selectedDevice}
                                        showNotification={showNotification}
                                    />
                                )}
                                {selectedDevice.origin === "onboarded" && selectedDevice.features?.telemetry?.enabled && (
                                    <>
                                        <SystemUtilization
                                            keycloak={keycloak}
                                            selectedDevice={selectedDevice}
                                            showNotification={showNotification}
                                        />
                                        <InterfaceStatistics
                                            keycloak={keycloak}
                                            selectedDevice={selectedDevice}
                                            showNotification={showNotification}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
}

export default Devices;