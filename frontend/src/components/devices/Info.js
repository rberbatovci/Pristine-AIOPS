import { 
  PiInfoDuotone, 
  PiXBold 
} from "react-icons/pi";
import '../../css/SignalInfoModern.css'; // Uses the new stylesheet matching your system tokens

const Info = ({ selectedDevice, onDeviceDeselect }) => {
  if (!selectedDevice) return null;

  // Determining device health dynamically based on your features structure
  const getDeviceHealth = (device) => {
    if (device.features?.telemetry?.cpu_util > 85) return { text: 'CRITICAL', className: 'text-critical' };
    if (device.features?.telemetry?.cpu_util > 65) return { text: 'WARNING', className: 'text-warning' };
    return { text: 'HEALTHY', className: 'text-healthy' };
  };

  const health = getDeviceHealth(selectedDevice);

  return (
    <div className="device-info-panel">
      
      {/* Dynamic Action Header Area */}
      <div className="info-header">
        <div className="header-title">
          <PiInfoDuotone style={{ color: 'var(--textColor)', fontSize: '18px' }} />
          <h2 style={{ color: 'var(--textColor)', fontSize: '14px' }}>Node Specifications</h2>
        </div>
        <button 
          onClick={onDeviceDeselect} 
          className="info-close-btn"
          title="Dismiss selection"
        >
          <PiXBold />
        </button>
      </div>

      {/* Structured Specification Matrix Data Grid */}
      <div className="info-grid-content">
        
        <div className="info-data-tile">
          <span className="tile-label">Hostname</span>
          <span className="tile-value value-highlight" title={selectedDevice.hostname}>
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
            {selectedDevice.vendor || 'Unknown'}
          </span>
        </div>

        <div className="info-data-tile">
          <span className="tile-label">Firmware Version</span>
          <span className="tile-value" title={selectedDevice.version}>
            {selectedDevice.version || '--'}
          </span>
        </div>

        <div className="info-data-tile full-width-tile">
          <span className="tile-label">Node Operational Health</span>
          <span className={`tile-value health-status-badge ${health.className}`}>
            <span className="status-indicator-dot"></span>
            {health.text}
          </span>
        </div>

      </div>

    </div>
  );
};

export default Info;