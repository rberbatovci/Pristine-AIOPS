import { useState, useEffect } from 'react';
import { 
  PiArrowDownDuotone, 
  PiArrowUpDuotone, 
  PiChartLineUpDuotone,
  PiWarningCircleDuotone,
  PiSquaresFourDuotone
} from "react-icons/pi";
import kcFetch from '../misc/kcFetch';
import '../../css/InterfaceStatisticsModern.css'; // New styles matching your dashboard theme

function InterfaceStatistics({ keycloak, selectedDevice }) {
  const [device, setDevice] = useState(selectedDevice);
  const [interfaces, setInterfaces] = useState([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  useEffect(() => {
    const fetchInterfaces = async () => {
      if (!selectedDevice?.hostname) {
        setInterfaces([]);
        return;
      }
      setInterfacesLoading(true);
      setError('');
      try {
        const response = await kcFetch(
          keycloak,
          `/devices/status/${selectedDevice.hostname}/interfaces/`
        );
        const interfacesArray = Object.entries(response).map(([name, stats]) => ({
          name,
          status: stats.status ?? '',
          rx_kbps: stats['rx-kbps'] ?? 0,
          rx_pps: stats['rx-pps'] ?? 0,
          tx_kbps: stats['tx-kbps'] ?? 0,
          tx_pps: stats['tx-pps'] ?? 0
        }));

        setInterfaces(interfacesArray);
      } catch (err) {
        console.error("Error fetching interfaces:", err);
        setError(err.message || 'Failed to sync networking interface maps.');
        setInterfaces([]);
      } finally {
        setInterfacesLoading(false);
      }
    };

    fetchInterfaces();
  }, [selectedDevice, keycloak]);

  // Safely drilling into your nested telemetry feature check
  const enabled = device?.features?.telemetry?.features?.interface_stats;

  return (
    <div className="interface-stats-panel" style={{ marginTop: '20px' }}>
      <div className="info-header">
        <div className="header-title">
          <PiChartLineUpDuotone style={{ color: 'var(--textColor)', fontSize: '18px' }} />
          <h3 style={{ color: 'var(--textColor)', fontSize: '14px' }}>Interface Metrics</h3>
        </div>
        <span className="interface-counter">
          Active Links: {interfaces.filter(i => i.status?.toLowerCase() === "if-oper-state-ready").length}/{interfaces.length}
        </span>
      </div>

      <div className="panel-content-scroll">
        {!enabled ? (
          <div className="telemetry-disabled-banner">
            <PiWarningCircleDuotone className="warning-icon" />
            <p>Interface telemetry metrics streaming is not configured or activated on this device node.</p>
          </div>
        ) : (
          <>
            {error && <div className="metrics-error-banner">{error}</div>}

            {interfacesLoading ? (
              <div className="panel-loading-state">
                <div className="loading-bar-pulse"></div>
                <p>Polling interface pipeline telemetry matrices...</p>
              </div>
            ) : interfaces.length === 0 ? (
              <div className="panel-empty-state">
                <PiSquaresFourDuotone />
                <p>No valid interfaces mapped to this host routing domain.</p>
              </div>
            ) : (
              <div className="interfaces-grid-list">
                {interfaces
                  .filter(intf => intf.name && intf.name.trim() !== "")
                  .map((intf, idx) => {
                    const isReady = intf.status?.toLowerCase() === "if-oper-state-ready";
                    
                    return (
                      <div className={`interface-row-card ${!isReady ? 'link-down' : ''}`} key={idx}>
                        
                        {/* Interface Identity Column */}
                        <div className="interface-identity">
                          <span className="interface-name" title={intf.name}>
                            {intf.name}
                          </span>
                          <span className={`status-pill ${isReady ? 'is-ready' : 'is-down'}`}>
                            {isReady ? 'READY' : 'DOWN'}
                          </span>
                        </div>

                        {/* Bandwidth Telemetry Grid Blocks */}
                        <div className="interface-telemetry-grid">
                          
                          {/* RX Stats */}
                          <div className="telemetry-lane rx-lane">
                            <div className="lane-label">
                              <PiArrowDownDuotone className="lane-arrow" />
                              <span>RX Traffic</span>
                            </div>
                            <div className="lane-metrics">
                              <span className="metric-primary">{intf.rx_kbps.toLocaleString()} <span className="metric-unit">kbps</span></span>
                              <span className="metric-secondary">{intf.rx_pps.toLocaleString()} <span className="metric-unit">pps</span></span>
                            </div>
                          </div>

                          {/* TX Stats */}
                          <div className="telemetry-lane tx-lane">
                            <div className="lane-label">
                              <PiArrowUpDuotone className="lane-arrow" />
                              <span>TX Traffic</span>
                            </div>
                            <div className="lane-metrics">
                              <span className="metric-primary">{intf.tx_kbps.toLocaleString()} <span className="metric-unit">kbps</span></span>
                              <span className="metric-secondary">{intf.tx_pps.toLocaleString()} <span className="metric-unit">pps</span></span>
                            </div>
                          </div>

                        </div>

                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InterfaceStatistics;