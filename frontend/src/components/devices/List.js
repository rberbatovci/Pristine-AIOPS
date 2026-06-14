import { useEffect, useState } from "react";
import { useDevices } from "../../hooks/useDevices";

import {
  PiTerminalDuotone,
  PiShareNetworkDuotone,
  PiPulseDuotone,
  PiSlidersHorizontalDuotone,
  PiHardDriveDuotone,
  PiTreeStructureDuotone,
  PiShieldCheckeredDuotone
} from "react-icons/pi";

import "../../css/DevicesList.css";

function List({ keycloak, onDeviceSelect }) {
  const { devices: initialDevices, loading: hookLoading, error } = useDevices(keycloak); 
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
 
  // Sync initial hook devices to local component state when they arrive
  useEffect(() => {
    if (!initialDevices || initialDevices.length === 0) return;

    setDevices(
      initialDevices.map((d) => ({
        ...d,
        status: d.status ?? "unknown",
        rtt_ms: d.rtt_ms ?? 0
      }))
    );
  }, [initialDevices]);
 
  // Handle WebSocket Connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.onopen = () => console.log("🔌 WebSocket connected");

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type !== "icmp_ping") return;

      setDevices((prev) =>
        prev.map((device) => {
          const match =
            (device.hostname ?? "").trim().toLowerCase() ===
            (msg.hostname ?? "").trim().toLowerCase();

          if (!match) return device;

          return {
            ...device,
            status: msg.status,
            rtt_ms: msg.rtt_ms
          };
        })
      );
    };

    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("❌ WebSocket disconnected");

    return () => ws.close();
  }, []);

  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
    onDeviceSelect?.(device);
  };

  const getDeviceHealth = (device) => {
    if (device.status === "down") return "critical";
    if ((device.rtt_ms ?? 0) > 150) return "warning";
    return "healthy";
  };

  // ===================================
  // DETERMINISTIC LOADING & RENDER GUARDS
  // ===================================
  
  // 1. If keycloak is not ready, we are authenticating
  if (!keycloak?.authenticated) {
    return (
      <div className="signals-list-container">
        <p>Authenticating session...</p>
      </div>
    );
  }

  // 2. If the hook is fetching, we are loading
  if (hookLoading) {
    return (
      <div className="signals-list-container">
        <p>Loading devices...</p>
      </div>
    );
  }

  // 3. If there's a backend error
  if (error) {
    return (
      <div className="signals-list-container">
        <p>Error loading devices</p>
      </div>
    );
  }

  // 4. If we finished loading, are authenticated, and truly have 0 devices
  if (initialDevices.length === 0) {
    return (
      <div className="signals-list-container">
        <p>No managed devices registered.</p>
      </div>
    );
  }

  // Fallback check: If initialDevices has data but our local state mapping hasn't 
  // caught up yet on this specific tick, show a temporary loading indicator
  if (devices.length === 0 && initialDevices.length > 0) {
    return (
      <div className="signals-list-container">
        <p>Preparing list...</p>
      </div>
    );
  }

  // =========================
  // RENDER
  // =========================
  return (
    <div className="signals-list-container">
      <ul className="signals-list">
        {devices.map((device) => {
          const health = getDeviceHealth(device);
          const isSelected = selectedDevice?.id === device.id;

          return (
            <li
              key={device.id}
              onClick={() => handleDeviceClick(device)}
              className={`device-list-card ${isSelected ? "selected" : ""}`}
            >
              {/* LEFT ICON */}
              <div className={`device-avatar badge-${health}`}>
                <PiHardDriveDuotone />
                <span className={`pulse-dot ring-${health}`} />
              </div>

              {/* CENTER INFO */}
              <div className="device-metadata-box">
                <div className="hostname-row">
                  <span className="device-hostname">{device.hostname}</span>
                </div>
                <div className="hardware-sub-row">
                  <span className="meta-item">IP: {device.ip_address}</span>
                  <span className="meta-divider">•</span>
                  <span className="meta-item">Status: {device.status ?? "unknown"}</span>
                  <span className="meta-divider">•</span>
                  <span className="meta-item">RTT: {device.rtt_ms ?? 0}ms</span>
                </div>
              </div>

              {/* RIGHT FEATURES */}
              <div className="device-features-matrix" onClick={(e) => e.stopPropagation()}>
                <div className={`feature-status-indicator ${device.features?.syslogs ? "enabled" : "disabled"}`}>
                  <PiTerminalDuotone />
                </div>
                <div className={`feature-status-indicator ${device.features?.netflow ? "enabled" : "disabled"}`}>
                  <PiShareNetworkDuotone />
                </div>
                <div className={`feature-status-indicator ${device.features?.telemetry?.enabled ? "enabled" : "disabled"}`}>
                  <PiPulseDuotone />
                </div>
                <div className={`feature-status-indicator ${device.features?.snmp_traps ? "enabled" : "disabled"}`}>
                  <PiSlidersHorizontalDuotone />
                </div>
                <div className={`feature-status-indicator ${device.features?.topology ? "enabled" : "disabled"}`}>
                  <PiTreeStructureDuotone />
                </div>
                <div className={`feature-status-indicator ${device.features?.authentication ? "enabled" : "disabled"}`}>
                  <PiShieldCheckeredDuotone />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default List;