import React, { useState, useMemo } from "react";
import {
  PiTerminalDuotone,
  PiShareNetworkDuotone,
  PiPulseDuotone,
  PiSlidersHorizontalDuotone,
  PiHardDriveDuotone,
  PiTreeStructureDuotone,
  PiShieldCheckeredDuotone,
  PiSpinnerGapDuotone,
  PiInfoDuotone
} from "react-icons/pi";
import { RiSearchEyeLine } from "react-icons/ri";
import "../../css/DevicesList.css";

function List({
  devices = [],
  loading,
  keycloak,
  onDeviceSelect,
  searchEvent
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // 1. Derive search term safely
  const filterValue = useMemo(() => {
    return searchEvent?.type === "filter"
      ? searchEvent.value.toLowerCase().trim()
      : "";
  }, [searchEvent]);

  // 2. Derive filtered devices in-memory
  const filteredDevices = useMemo(() => {
    if (!filterValue) return devices;

    return devices.filter((device) => {
      const hostnameMatch = device.hostname?.toLowerCase().includes(filterValue);
      const ipMatch = device.ip_address?.toLowerCase().includes(filterValue);
      return hostnameMatch || ipMatch;
    });
  }, [devices, filterValue]);

  // 3. Selection handler
  const handleDeviceClick = (device) => {
    if (device.status === "deep_scanning") return; // block interaction while profiling
    setSelectedDeviceId(device.id || device.ip_address);
    onDeviceSelect?.(device);
  };

  // 4. Determine health status ring color
  const getDeviceHealth = (device) => {
    if (device.status === "down" || device.ping_status === "down") return "critical";
    if (device.status === "deep_scanning") return "processing";
    if (!device.isOnboarded) return "scanned";
    if (device.status === "unknown" || device.ping_status === "unknown") return "unknown";
    if ((device.ping_rtt_ms ?? device.rtt_ms ?? 0) > 150) return "warning";
    return "healthy";
  };

  // Guard Clauses for early returns
  if (!keycloak?.authenticated) {
    return (
      <div className="signals-list-container">
        <p>Authenticating session...</p>
      </div>
    );
  }

  if (loading && devices.length === 0) {
    return (
      <div className="signals-list-container">
        <p>Loading topology mappings...</p>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="signals-list-container">
        <p>No devices mapped. Run a network sweep scan to begin discovery.</p>
      </div>
    );
  }

  return (
    <div className="device-list-container">
      <div className="info-header">
        <div className="header-title">
          <PiInfoDuotone style={{ color: "var(--textColor)", fontSize: "18px" }} />
          <h2 style={{ color: "var(--textColor)", fontSize: "14px" }}>
            Node Specifications
          </h2>
        </div>
      </div>

      <div className="signals-list-container" style={{ padding: "10px" }}>
        <ul className="signals-list">
          {filteredDevices.map((device) => {
            const deviceKey = device.id || device.ip_address;
            const health = getDeviceHealth(device);
            const isSelected = selectedDeviceId === deviceKey;
            const isDiscoveredTarget = !device.isOnboarded;
            const isScanning = device.status === "deep_scanning";

            return (
              <li
                key={deviceKey}
                onClick={() => handleDeviceClick(device)}
                className={`device-list-card ${isSelected ? "selected" : ""} ${
                  isScanning ? "scanning-lock" : ""
                }`}
              >
                {/* LEFT AVATAR ICON */}
                <div className="device-avatar">
                  {isScanning ? (
                    <PiSpinnerGapDuotone className="spin-animation" />
                  ) : (
                    <PiHardDriveDuotone />
                  )}
                  <span className={`pulse-dot ring-${health}`} />
                </div>

                {/* METADATA BOX */}
                <div className="device-metadata-box">
                  <div className="hostname-row">
                    <span className="device-hostname">
                      {device.hostname || device.ip_address}
                    </span>

                    {/* Ping Status Badge for Onboarded Devices */}
                    {!isScanning && device.isOnboarded && (
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          marginLeft: "8px",
                          fontWeight: "bold",
                          background:
                            device.ping_status === "up" || device.status === "up"
                              ? "#198754"
                              : device.ping_status === "down" || device.status === "down"
                              ? "#dc3545"
                              : "#6c757d",
                          color: "#fff"
                        }}
                      >
                        {device.ping_status === "up" || device.status === "up"
                          ? "Reachable"
                          : device.ping_status === "down" || device.status === "down"
                          ? "Down"
                          : "Unknown"}
                      </span>
                    )}

                    {/* Scanning Badge */}
                    {isScanning && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#fd7e14",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          marginLeft: "8px",
                          fontWeight: "bold"
                        }}
                      >
                        Profiling...
                      </span>
                    )}

                    {/* Discovered Badge */}
                    {isDiscoveredTarget && !isScanning && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#007bff",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          marginLeft: "8px",
                          fontWeight: "bold"
                        }}
                      >
                        Discovered
                      </span>
                    )}
                  </div>

                  {/* IP + RTT Details */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginTop: "4px",
                      fontSize: "11px",
                      color: "var(--textColorSecondary)"
                    }}
                  >
                    <span>{device.ip_address || device.ip}</span>

                    {device.isOnboarded && (
                      <span>
                        RTT:{" "}
                        {device.ping_status === "up" || device.status === "up"
                          ? `${device.ping_rtt_ms ?? device.rtt_ms ?? 0} ms`
                          : "—"}
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTION / FEATURE MATRIX */}
                <div className="device-actions-wrapper">
                  {isDiscoveredTarget && !isScanning ? (
                    <div className="feature-status-indicator">
                      <RiSearchEyeLine />
                    </div>
                  ) : (
                    <div
                      className="device-features-matrix"
                      onClick={(e) => e.stopPropagation()}
                      style={
                        isDiscoveredTarget || isScanning
                          ? { opacity: 0.3, pointerEvents: "none" }
                          : {}
                      }
                    >
                      <div
                        className={`feature-status-indicator ${
                          device.features?.syslogs ? "enabled" : "disabled"
                        }`}
                      >
                        <PiTerminalDuotone />
                      </div>
                      <div
                        className={`feature-status-indicator ${
                          device.features?.snmp_traps ? "enabled" : "disabled"
                        }`}
                      >
                        <PiShareNetworkDuotone />
                      </div>
                      <div
                        className={`feature-status-indicator ${
                          device.features?.netflow ? "enabled" : "disabled"
                        }`}
                      >
                        <PiPulseDuotone />
                      </div>
                      <div
                        className={`feature-status-indicator ${
                          device.features?.telemetry?.enabled ? "enabled" : "disabled"
                        }`}
                      >
                        <PiSlidersHorizontalDuotone />
                      </div>
                      <div
                        className={`feature-status-indicator ${
                          device.features?.topology ? "enabled" : "disabled"
                        }`}
                      >
                        <PiTreeStructureDuotone />
                      </div>
                      <div
                        className={`feature-status-indicator ${
                          device.features?.authentication ? "enabled" : "disabled"
                        }`}
                      >
                        <PiShieldCheckeredDuotone />
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default List;