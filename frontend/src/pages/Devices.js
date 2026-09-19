import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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

    // Dynamic updates via WebSockets stored locally to avoid re-fetching
    const [realtimeUpdates, setRealtimeUpdates] = useState({});

    // 1. Primary Data Sources
    const {
        devices: onboardedDevices = [],
        loading: hookLoading,
        reload: fetchDevices
    } = useDevices(keycloak);

    const {
        scanNetwork,
        devices: discoveredDevices = [],
        loading: sweepLoading
    } = useNetworkScan(keycloak, showNotification);

    // Pass static onboarded devices to Redis polling hook
    const {
        data: devicesPing = [],
        loading: pingLoading,
        reload: reloadPing
    } = useDevicePing(
        keycloak,
        onboardedDevices,
        true,
        0
    );

    const { deepScanDevice, loading: deepScanLoading } = useDeviceDeepScan(keycloak);

    // 2. Centralized Merging Strategy (O(N) performance using Maps)
    const mergedDevices = useMemo(() => {
        // Map Ping data (Redis)
        const pingMap = new Map();
        devicesPing.forEach((ping) => {
            const key = ping.ip_address || ping.ip || ping.hostname;
            if (key) pingMap.set(key, ping);
        });

        // Map Discovered Devices (Network Sweep)
        const discoveredMap = new Map();
        discoveredDevices.forEach((disc) => {
            const key = disc.ip || disc.ip_address;
            if (key) discoveredMap.set(key, disc);
        });

        // Step A: Map PostgreSQL Onboarded Devices
        const combined = onboardedDevices.map((device) => {
            const primaryKey = device.ip_address || device.ip || device.hostname;
            const pingInfo = pingMap.get(primaryKey) || pingMap.get(device.hostname) || {};
            const liveUpdate = realtimeUpdates[primaryKey] || {};

            return {
                ...device,
                ip_address: device.ip_address || device.ip,
                isOnboarded: true,
                origin: "onboarded",

                // Ping state prioritization: WS updates > Redis Ping > DB defaults
                ping_status: liveUpdate.status || pingInfo.status || device.status || "unknown",
                ping_rtt_ms: liveUpdate.rtt_ms ?? pingInfo.rtt_ms ?? device.rtt_ms ?? null,
                ping_timestamp: liveUpdate.timestamp || pingInfo.timestamp || null,

                // Realtime metrics
                cpu_util: liveUpdate.cpu_util ?? device.cpu_util,
                memory_util: liveUpdate.memory_util ?? device.memory_util,
                ...liveUpdate
            };
        });

        // Step B: Append Discovered Devices that aren't onboarded yet
        discoveredDevices.forEach((disc) => {
            const discKey = disc.ip || disc.ip_address;
            const alreadyOnboarded = onboardedDevices.some(
                (o) => (o.ip_address || o.ip) === discKey || o.hostname === disc.hostname
            );

            if (!alreadyOnboarded) {
                const pingInfo = pingMap.get(discKey) || {};
                const liveUpdate = realtimeUpdates[discKey] || {};

                combined.push({
                    id: discKey,
                    hostname: disc.hostname || discKey,
                    ip_address: discKey,
                    isOnboarded: false,
                    origin: "discovered",
                    status: liveUpdate.status || disc.status || "discovered",
                    features: {},
                    ...disc,
                    ...liveUpdate
                });
            }
        });

        return combined;
    }, [onboardedDevices, devicesPing, discoveredDevices, realtimeUpdates]);

    // 3. Helper for device comparisons
    const isSameDevice = useCallback((a, b) => {
        if (!a || !b) return false;
        return (
            (a.hostname || "").toLowerCase() === (b.hostname || "").toLowerCase() ||
            (a.ip_address || a.ip) === (b.ip_address || b.ip)
        );
    }, []);

    // 4. Handle Incoming WebSocket Realtime Updates
    const handleWsUpdate = useCallback((msg) => {
        const key = msg.ip_address || msg.ip || msg.hostname;
        if (!key) return;

        setRealtimeUpdates((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || {}),
                ...msg
            }
        }));

        // Keep active detail panel up to date if selected device changed
        setSelectedDevice((prevSelected) => {
            if (!prevSelected || !isSameDevice(prevSelected, msg)) return prevSelected;
            return {
                ...prevSelected,
                ...msg
            };
        });
    }, [isSameDevice, setSelectedDevice]);

    // 5. Lifecycle & Effects
    useEffect(() => {
        setSelectedDevice(null);
    }, []);

    useEffect(() => {
        setDashboardTitle("Devices Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    useEffect(() => {
        fetchDevices();
        reloadPing();
    }, [devicesRefreshKey, fetchDevices, reloadPing]);

    // Handle Search Bar Triggered Scans
    useEffect(() => {
        if (!searchEvent) return;
        if (searchEvent.type === 'network') {
            scanNetwork(searchEvent.value).catch((err) => {
                console.error("Scan failed:", err);
                showNotification?.("Network scan failed", "error");
            });
        }
        if (searchEvent.type === 'deepScan' && selectedDevice) {
            handleDeepScan(selectedDevice).catch((err) => {
                console.error("Deep scan failed:", err);
                showNotification?.("Deep scan failed", "error");
            });
        }
    }, [searchEvent]);

    // WebSocket Manager
    useEffect(() => {
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const ws = new WebSocket(`${protocol}://${window.location.host}/ws/ping`);
        socketRef.current = ws;

        ws.onopen = () => console.log("🔌 WebSocket connected");
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (["icmp_ping", "device_update", "cpu_util", "memory_util"].includes(msg.type)) {
                    handleWsUpdate(msg);
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
    }, [handleWsUpdate]);

    // 6. Action Handlers
    const handleDeepScan = async (device) => {
        if (device.origin !== "discovered") return;

        showNotification?.(`Initiating deep scan for ${device.ip_address}`, "info");

        try {
            const scanData = await deepScanDevice(device.ip_address);
            const deepScanUpdate = {
                ...device,
                ip_address: scanData.results.ip,
                state: scanData.results.state,
                os_match: scanData.results.os_match,
                protocols: scanData.results.protocols,
                tcp_ports: scanData.results.protocols?.tcp || [],
                origin: "discovered",
                isDeepScanned: true
            };

            handleWsUpdate(deepScanUpdate);
            showNotification?.("Deep scan completed", "success");
        } catch (err) {
            console.error(err);
            showNotification?.("Deep scan failed", "error");
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
                ...device, // Keep live metrics attached
                origin: "onboarded"
            });
        } catch (err) {
            console.error(err);
            showNotification?.("Failed to load device details", "error");
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
    const isInitialLoading = hookLoading && onboardedDevices.length === 0;

    return (
        <div
            className="devices-container"
            style={{
                display: 'flex',
                width: isExpanded ? '80%' : '40%',
                transition: 'width 0.6s ease'
            }}
        >
            <div
                style={{
                    width: isExpanded ? '40%' : '100%',
                    transition: 'width 0.6s ease-in-out',
                    overflow: 'hidden',
                    height: 'calc(100vh - 50px)'
                }}
            >
                <div className="mainContainer">
                    <List
                        devices={mergedDevices}
                        loading={isInitialLoading || sweepLoading || deepScanLoading}
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
                }}
            >
                <div className="right-content-wrapper">
                    <div className="right-content" style={{ margin: "10px" }}>
                        {showComponents && selectedDevice && (
                            <>
                                <Info
                                    selectedDevice={selectedDevice}
                                    onDeviceDeselect={handleDeviceDeselect}
                                    keycloak={keycloak}
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