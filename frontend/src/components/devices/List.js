import { useEffect, useState } from "react";
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

// ✅ Accept the unified dynamic props from Devices.js
function List({ onboardedDevices = [], discoveredDevices = [], loading, keycloak, onDeviceSelect }) {  
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [localDevices, setLocalDevices] = useState([]);

  // 🔄 Sync incoming prop arrays into a unified tracking state array
  useEffect(() => {
    // Flag onboarded items clearly vs dynamically discovered items
    const managed = onboardedDevices.map(d => ({ ...d, origin: 'onboarded' }));
    
    const existingIPs = new Set(managed.map(d => d.ip_address));
    
    const discovered = discoveredDevices
      .filter(d => !existingIPs.has(d.ip)) // Avoid duplicates if already onboarded
      .map(d => ({
        id: d.ip,
        hostname: d.hostname || d.ip,
        ip_address: d.ip,
        status: "discovered",
        rtt_ms: 0,
        features: {}, // Discovered devices won't have profiling features active yet
        origin: 'discovered',
        nmap: { discovered: true }
      }));

    setLocalDevices([...managed, ...discovered]);
  }, [onboardedDevices, discoveredDevices]);

  // -----------------------------
  // ICMP handler
  // -----------------------------
  const handlePingUpdate = (msg) => {
    setLocalDevices((prev) =>
      prev.map((device) => {
        const match =
          (device.hostname ?? "").toLowerCase() ===
          (msg.hostname ?? "").toLowerCase() || 
          device.ip_address === msg.ip_address;

        if (!match) return device;

        return {
          ...device,
          status: msg.status,
          rtt_ms: msg.rtt_ms
        };
      })
    );
  };

  // -----------------------------
  // Nmap Sweeper dynamic updates
  // -----------------------------
  const handleNmapUpdate = (payload) => {
    const hostList = payload?.hosts;
    if (!Array.isArray(hostList)) return;

    const discoveredSet = new Set(hostList);

    setLocalDevices((prev) => {
      const existingIPs = new Set(prev.map(d => d.ip_address));

      // 1. Update existing elements in view
      const updated = prev.map((device) => {
        const isDiscovered = discoveredSet.has(device.ip_address);
        return {
          ...device,
          nmap: {
            ...device.nmap,
            status: "scanned",
            discovered: isDiscovered,
            last_scan: payload.target,
            scan_time: new Date().toISOString()
          }
        };
      });

      // 2. Append newly identified runtime sweeps
      const newDevices = hostList
        .filter(ip => !existingIPs.has(ip))
        .map(ip => ({
          id: ip,
          hostname: ip,
          ip_address: ip,
          status: "discovered",
          rtt_ms: 0,
          features: {},
          origin: 'discovered',
          nmap: {
            discovered: true,
            last_scan: payload.target,
            scan_time: new Date().toISOString()
          }
        }));

      return [...updated, ...newDevices];
    });
  };

  // -----------------------------
  // WebSocket setup
  // -----------------------------
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.onopen = () => console.log("🔌 WebSocket connected");

    ws.onmessage = (event) => {
      try {
        const rawMsg = JSON.parse(event.data);
        const msg = rawMsg.payload && rawMsg.type === undefined
          ? { ...rawMsg.payload, type: rawMsg.type || rawMsg.payload.type }
          : rawMsg;

        switch (msg.type) {
          case "icmp_ping":
            handlePingUpdate(msg);
            break;
          case "nmap_scan":
            handleNmapUpdate(msg.payload);
            break;
          default:
            console.warn("Unknown websocket message:", msg);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
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
    if (device.status === "discovered") return "scanned"; // Soft blue badge indicator for scan targets
    if ((device.rtt_ms ?? 0) > 150) return "warning";
    return "healthy";
  };

  // -----------------------------
  // Render Guards
  // -----------------------------
  if (!keycloak?.authenticated) {
    return <div className="signals-list-container"><p>Authenticating session...</p></div>;
  }

  if (loading && localDevices.length === 0) {
    return <div className="signals-list-container"><p>Loading topology mappings...</p></div>;
  }

  if (localDevices.length === 0) {
    return <div className="signals-list-container"><p>No devices mapped. Run a network sweep scan to begin discovery.</p></div>;
  }

  return (
    <div className="signals-list-container">
      <ul className="signals-list">
        {localDevices.map((device) => {
          const health = getDeviceHealth(device);
          const isSelected = selectedDevice?.id === device.id;
          const isDiscoveredTarget = device.origin === 'discovered';

          return (
            <li
              key={device.id}
              onClick={() => handleDeviceClick(device)}
              className={`device-list-card ${isSelected ? "selected" : ""}`}
              style={isDiscoveredTarget ? { borderLeft: '4px solid #007bff', background: '#f8faff' } : {}}
            >
              {/* LEFT AVATAR ICON */}
              <div className={`device-avatar badge-${health}`}>
                <PiHardDriveDuotone />
                <span className={`pulse-dot ring-${health}`} />
              </div>

              {/* CENTER COMPONENT INFO */}
              <div className="device-metadata-box">
                <div className="hostname-row">
                  <span className="device-hostname">
                    {device.hostname}
                  </span>
                  {/* Subtle badge to let operators know this device is a raw target, not onboarded yet */}
                  {isDiscoveredTarget && (
                    <span style={{ fontSize: '10px', background: '#007bff', color: '#fff', padding: '1px 6px', borderRadius: '8px', marginLeft: '8px', fontWeight: 'bold' }}>
                      Discovered
                    </span>
                  )}
                </div>

                <div className="hardware-sub-row">
                  <span className="meta-item">
                    IP: {device.ip_address}
                  </span>
                  {device.rtt_ms > 0 && (
                    <>
                      <span className="meta-divider">•</span>
                      <span className="meta-item">Latency: {device.rtt_ms}ms</span>
                    </>
                  )}
                </div>
              </div>

              {/* RIGHT SIDE CAPABILITIES MATRIX */}
              <div
                className="device-features-matrix"
                onClick={(e) => e.stopPropagation()}
                style={isDiscoveredTarget ? { opacity: 0.3, pointerEvents: 'none' } : {}}
              >
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