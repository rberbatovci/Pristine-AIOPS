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
  const { devices: initialDevices, loading: hookLoading, error } =
    useDevices(keycloak);

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);

  // -----------------------------
  // Sync initial devices
  // -----------------------------
useEffect(() => {
  if (!initialDevices?.length) return;

  setDevices(
    initialDevices.map((d) => ({
      ...d,

      // Always start as unknown
      status: "unknown",
      rtt_ms: 0,

      nmap: {
        discovered: false,
        ...(d.nmap || {})
      }
    }))
  );
}, [initialDevices]);

  // -----------------------------
  // ICMP handler
  // -----------------------------
  const handlePingUpdate = (msg) => {
    setDevices((prev) =>
      prev.map((device) => {
        const match =
          (device.hostname ?? "").toLowerCase() ===
          (msg.hostname ?? "").toLowerCase();

        if (!match) return device;

        return {
          ...device,
          status: msg.status,
          rtt_ms: msg.rtt_ms
        };
      })
    );
  };

  const handleNmapUpdate = (payload) => {
    const hostList = payload?.hosts;
    if (!Array.isArray(hostList)) return;

    const discoveredSet = new Set(hostList);

    setDevices((prev) => {
      const existingIPs = new Set(prev.map(d => d.ip_address));

      // 1. Update existing devices
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

      // 2. Add NEW discovered hosts
      const newDevices = hostList
        .filter(ip => !existingIPs.has(ip))
        .map(ip => ({
          id: ip,
          hostname: ip,
          ip_address: ip,

          status: "unknown",
          rtt_ms: 0,

          features: {},

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
  // WebSocket
  // -----------------------------
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

    ws.onopen = () => console.log("🔌 WebSocket connected");

    ws.onmessage = (event) => {
      try {
        const rawMsg = JSON.parse(event.data);

        // Normalize structure if backend wraps fields inside a 'payload' object
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

  // -----------------------------
  // UI helpers
  // -----------------------------
  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
    onDeviceSelect?.(device);
  };

  const getDeviceHealth = (device) => {
    if (device.status === "down") return "critical";
    if ((device.rtt_ms ?? 0) > 150) return "warning";
    if (device.status === "scanned") return "scanned";
    if (device.status === "unknown") return "scanned";
    return "healthy";
  };

  // -----------------------------
  // Guards
  // -----------------------------
  if (!keycloak?.authenticated) {
    return (
      <div className="signals-list-container">
        <p>Authenticating session...</p>
      </div>
    );
  }

  if (hookLoading) {
    return (
      <div className="signals-list-container">
        <p>Loading devices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="signals-list-container">
        <p>Error loading devices</p>
      </div>
    );
  }

  if (initialDevices.length === 0) {
    return (
      <div className="signals-list-container">
        <p>No managed devices registered.</p>
      </div>
    );
  }

  if (devices.length === 0 && initialDevices.length > 0) {
    return (
      <div className="signals-list-container">
        <p>Preparing list...</p>
      </div>
    );
  }

  // -----------------------------
  // Render
  // -----------------------------
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
                  <span className="device-hostname">
                    {device.hostname}
                  </span>
                </div>

                <div className="hardware-sub-row">
                  <span className="meta-item">
                    IP: {device.ip_address}
                  </span>

                  <span className="meta-divider">•</span>
 
                </div>
              </div>

              {/* RIGHT FEATURES */}
              <div
                className="device-features-matrix"
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  className={`feature-status-indicator ${device.features?.syslogs ? "enabled" : "disabled"
                    }`}
                >
                  <PiTerminalDuotone />
                </div>

                <div
                  className={`feature-status-indicator ${device.features?.netflow ? "enabled" : "disabled"
                    }`}
                >
                  <PiShareNetworkDuotone />
                </div>

                <div
                  className={`feature-status-indicator ${device.features?.telemetry?.enabled
                    ? "enabled"
                    : "disabled"
                    }`}
                >
                  <PiPulseDuotone />
                </div>

                <div
                  className={`feature-status-indicator ${device.features?.snmp_traps
                    ? "enabled"
                    : "disabled"
                    }`}
                >
                  <PiSlidersHorizontalDuotone />
                </div>

                <div
                  className={`feature-status-indicator ${device.features?.topology ? "enabled" : "disabled"
                    }`}
                >
                  <PiTreeStructureDuotone />
                </div>

                <div
                  className={`feature-status-indicator ${device.features?.authentication
                    ? "enabled"
                    : "disabled"
                    }`}
                >
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