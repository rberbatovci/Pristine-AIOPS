import {
  PiInfoDuotone,
  PiXBold
} from "react-icons/pi";
import '../../css/SignalInfoModern.css';

const Info = ({ selectedDevice, onDeviceDeselect }) => {
  if (!selectedDevice) return null; 
  const getDeviceHealth = (device) => {
    if (device.features?.telemetry?.cpu_util > 85) return { text: 'CRITICAL', className: 'text-critical' };
    if (device.features?.telemetry?.cpu_util > 65) return { text: 'WARNING', className: 'text-warning' };
    return { text: 'HEALTHY', className: 'text-healthy' };
  };
  const health = getDeviceHealth(selectedDevice); 
  console.log("Selected Device:", selectedDevice);
  return (
    <div className="device-info-panel">
      {/* Header */}
      <div className="info-header">
        <div className="header-title">
          <PiInfoDuotone
            style={{ color: "var(--textColor)", fontSize: "18px" }}
          />
          <h2 style={{ color: "var(--textColor)", fontSize: "14px" }}>
            Node Specifications
          </h2>
        </div>

        <button
          onClick={onDeviceDeselect}
          className="info-close-btn"
          title="Dismiss selection"
        >
          <PiXBold />
        </button>
      </div> 
      <div className="info-grid-content">
        <div className="info-data-tile">
          <span className="tile-label">Hostname</span>
          <span
            className="tile-value value-highlight"
            title={selectedDevice.hostname}
          >
            {selectedDevice.hostname}
          </span>
        </div>

        <div className="info-data-tile">
          <span className="tile-label">IP Address</span>
          <span className="tile-value monospace-data">
            {selectedDevice.ip_address}
          </span>
        </div>

        <div className="info-data-tile">
          <span className="tile-label">Vendor</span>
          <span className="tile-value">
            {selectedDevice.vendor || "Unknown"}
          </span>
        </div>

        <div className="info-data-tile">
          <span className="tile-label">Origin</span>
          <span className="tile-value">
            {selectedDevice.origin === "discovery"
              ? "Discovered Device"
              : "Onboarded Device"}
          </span>
        </div>

        {selectedDevice.os_match?.length > 0 && (
          <div className="info-data-tile">
            <span className="tile-label">Operating System</span>
            <span className="tile-value">
              {selectedDevice.os_match[0]?.name || "Unknown"}
            </span>
          </div>
        )}

        {selectedDevice.version && (
          <div className="info-data-tile">
            <span className="tile-label">Firmware Version</span>
            <span
              className="tile-value"
              title={selectedDevice.version}
            >
              {selectedDevice.version}
            </span>
          </div>
        )}

        {/* Discovery Only */}
        {selectedDevice.origin === "discovery" && (
          <div className="info-data-tile full-width-tile">
            <span className="tile-label">Open TCP Services</span>

            {selectedDevice.protocols?.tcp?.length > 0 ? (
              <div className="protocols-list">
                {selectedDevice.protocols.tcp.map((service) => (
                  <div
                    key={service.port}
                    className="protocol-row"
                  >
                    <div className="protocol-port">
                      {service.port}
                    </div> 
                    <div className="protocol-details">
                      <div className="protocol-name">
                        {service.name.toUpperCase()}
                      </div>

                      <div className="protocol-product">
                        {service.product || "Unknown Service"}
                        {service.version && ` ${service.version}`}
                      </div>
                    </div>

                    <span className={`protocol-state ${service.state}`}>
                      {service.state}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="tile-value">
                No TCP services discovered
              </span>
            )}
          </div>
        )} 
        <div className="info-data-tile full-width-tile">
          <span className="tile-label">Node Operational Health</span> 
          <span className={`tile-value health-status-badge ${health.className}`} >
            <span className="status-indicator-dot"></span>
            {health.text}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Info;