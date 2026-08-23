import { useEffect, useState } from "react";
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
import "../../css/DevicesList.css";
import { RiSearchEyeLine } from "react-icons/ri";

function List({ onboardedDevices = [], discoveredDevices = [], devicesPing = [], loading, keycloak, onDeviceSelect, searchEvent }) {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [localDevices, setLocalDevices] = useState([]);
  const [socket, setSocket] = useState(null);

  console.log("Devices ping data:", devicesPing);

  const filterValue =
    searchEvent?.type === "filter"
      ? searchEvent.value.toLowerCase().trim()
      : "";

  const filteredDevices = filterValue
    ? localDevices.filter((device) => {
      const matches =
        device.hostname?.toLowerCase().includes(filterValue) ||
        device.ip_address?.includes(filterValue);
      return matches;
    })
    : localDevices;

  useEffect(() => {
    /*
     * Build a lookup table from devicesPing.
     *
     * devicesPing example:
     * {
     *   id: 5,
     *   hostname: "CiscoNexus9000",
     *   ip_address: "192.168.1.193",
     *   status: "down",
     *   rtt_ms: 0,
     *   timestamp: "2026-08-12T18:40:19Z"
     * }
     */
    const pingMap = new Map();

    devicesPing.forEach((ping) => {
      if (ping.ip_address) {
        pingMap.set(ping.ip_address, ping);
      }

      // Also allow hostname matching as a fallback
      if (ping.hostname) {
        pingMap.set(`hostname:${ping.hostname}`, ping);
      }
    });

    const managed = onboardedDevices.map((device) => {
      const pingData =
        pingMap.get(device.ip_address) ||
        pingMap.get(`hostname:${device.hostname}`);

      return {
        ...device,

        origin: "onboarded",

        // Ping state
        ping_status: pingData?.status ?? "unknown",
        ping_rtt_ms: pingData?.rtt_ms ?? null,
        ping_timestamp: pingData?.timestamp ?? null,

        // Keep status compatible with your existing health logic
        status: pingData?.status ?? device.status ?? "unknown",

        // Keep rtt_ms compatible with existing code
        rtt_ms: pingData?.rtt_ms ?? device.rtt_ms ?? 0,
      };
    });

    const existingIPs = new Set(
      managed.map((device) => device.ip_address)
    );

    const discovered = discoveredDevices
      .filter((device) => !existingIPs.has(device.ip))
      .map((device) => {
        const pingData = pingMap.get(device.ip);

        return {
          id: device.ip,
          hostname: device.hostname || device.ip,
          ip_address: device.ip,

          status: pingData?.status ?? "discovered",
          rtt_ms: pingData?.rtt_ms ?? 0,

          ping_status: pingData?.status ?? "unknown",
          ping_rtt_ms: pingData?.rtt_ms ?? null,
          ping_timestamp: pingData?.timestamp ?? null,

          features: {},
          origin: "discovered",
        };
      });

    setLocalDevices([
      ...managed,
      ...discovered,
    ]);

  }, [onboardedDevices, discoveredDevices, devicesPing]);

  const handleDeviceClick = (device) => {
    if (device.status === "deep_scanning") return; // block interaction while profiling
    setSelectedDevice(device);
    onDeviceSelect?.(device);
  };

  const getDeviceHealth = (device) => {
    if (device.status === "down") return "critical";
    if (device.status === "deep_scanning") return "processing"; // Blinking/spinning custom CSS
    if (device.status === "discovered") return "scanned";
    if (device.status === "unknown") return "unknown";
    if ((device.rtt_ms ?? 0) > 150) return "warning";
    return "healthy";
  };

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
    <div className="device-list-container">
      <div className="info-header">
        <div className="header-title">
          <PiInfoDuotone style={{ color: 'var(--textColor)', fontSize: '18px' }} />
          <h2 style={{ color: 'var(--textColor)', fontSize: '14px' }}>Node Specifications</h2>
        </div>
      </div>
      <div className="signals-list-container" style={{ padding: '10px' }}>
        <ul className="signals-list">
          {filteredDevices.map((device) => {
            const health = getDeviceHealth(device);
            const isSelected = selectedDevice?.id === device.id;
            const isDiscoveredTarget = device.origin === 'discovered';
            const isScanning = device.status === "deep_scanning";

            return (
              <li
                key={device.id}
                onClick={() => handleDeviceClick(device)}
                className={`device-list-card ${isSelected ? "selected" : ""} ${isScanning ? "scanning-lock" : ""}`}
              >
                {/* LEFT AVATAR ICON */}
                <div className={`device-avatar`}>
                  {isScanning ? <PiSpinnerGapDuotone className="spin-animation" /> : <PiHardDriveDuotone />}
                  <span className={`pulse-dot ring-${health}`} />
                </div>

                <div className="device-metadata-box">
                  <div className="hostname-row">
                    <span className="device-hostname">
                      {device.hostname}
                    </span>

                    {/* Ping status */}
                    {!isScanning && device.origin === "onboarded" && (
                      <span
                        style={{
                          fontSize: "10px",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          marginLeft: "8px",
                          fontWeight: "bold",
                          background:
                            device.ping_status === "up"
                              ? "#198754"
                              : device.ping_status === "down"
                                ? "#dc3545"
                                : "#6c757d",
                          color: "#fff",
                        }}
                      >
                        {device.ping_status === "up"
                          ? "Reachable"
                          : device.ping_status === "down"
                            ? "Down"
                            : "Unknown"}
                      </span>
                    )}

                    {isScanning && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#fd7e14",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          marginLeft: "8px",
                          fontWeight: "bold",
                        }}
                      >
                        Profiling...
                      </span>
                    )}

                    {isDiscoveredTarget && !isScanning && (
                      <span
                        style={{
                          fontSize: "10px",
                          background: "#007bff",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          marginLeft: "8px",
                          fontWeight: "bold",
                        }}
                      >
                        Discovered
                      </span>
                    )}
                  </div>

                  {/* IP + RTT */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginTop: "4px",
                      fontSize: "11px",
                      color: "var(--textColorSecondary)",
                    }}
                  >
                    <span>
                      {device.ip_address}
                    </span>

                    {device.origin === "onboarded" && (
                      <span>
                        RTT:{" "}
                        {device.ping_status === "up"
                          ? `${device.ping_rtt_ms ?? 0} ms`
                          : "—"}
                      </span>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE CAPABILITIES / ACTION PANEL */}
                <div className="device-actions-wrapper">
                  {isDiscoveredTarget && !isScanning ? (
                    <div className="feature-status-indicator">
                      <RiSearchEyeLine />
                    </div>
                  ) : (
                    <div
                      className="device-features-matrix"
                      onClick={(e) => e.stopPropagation()}
                      style={isDiscoveredTarget || isScanning ? { opacity: 0.3, pointerEvents: 'none' } : {}}
                    >
                      <div className={`feature-status-indicator ${device.features?.syslogs ? "enabled" : "disabled"}`}>
                        <PiTerminalDuotone />
                      </div>
                      <div className={`feature-status-indicator ${device.features?.snmp_traps ? "enabled" : "disabled"}`}>
                        <PiShareNetworkDuotone />
                      </div>
                      <div className={`feature-status-indicator ${device.features?.netflow ? "enabled" : "disabled"}`}>
                        <PiPulseDuotone />
                      </div>
                      <div className={`feature-status-indicator ${device.features?.telemetry?.enabled ? "enabled" : "disabled"}`}>
                        <PiSlidersHorizontalDuotone />
                      </div>
                      <div className={`feature-status-indicator ${device.features?.topology ? "enabled" : "disabled"}`}>
                        <PiTreeStructureDuotone />
                      </div>
                      <div className={`feature-status-indicator ${device.features?.authentication ? "enabled" : "disabled"}`}>
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