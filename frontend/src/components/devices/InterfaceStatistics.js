import { useState, useEffect } from 'react';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import { pushConfiguration } from '../../hooks/pushConfiguration';
import kcFetch from '../misc/kcFetch';

function InterfaceStatistics({ keycloak, selectedDevice, onSuccess, showNotification }) {
  const [device, setDevice] = useState(selectedDevice);
  const [interfaces, setInterfaces] = useState([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  const handlePush = async () => {
    setLoading(true);
    setError('');

    try {
      await pushConfiguration({
        keycloak,
        device,
        featureKey: "interface_stats",
        endpoint: "interface_stats",
        showNotification
      });

      // Optimistic UI update
      setDevice(prev => ({
        ...prev,
        features: {
          ...prev.features,
          telemetry: {
            ...prev.features.telemetry,
            interface_stats: true
          }
        }
      }));

      onSuccess?.();
    } catch (err) {
      setError(err?.message || 'Failed to configure interface statistics telemetry');
    } finally {
      setLoading(false);
    }
  };

  // Fetch interfaces
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
          rx_kbps: stats['rx-kbps'] ?? '',
          rx_pps: stats['rx-pps'] ?? '',
          tx_kbps: stats['tx-kbps'] ?? '',
          tx_pps: stats['tx-pps'] ?? ''
        }));

        setInterfaces(interfacesArray);
      } catch (err) {
        console.error("Error fetching interfaces:", err);
        setError(err.response?.data?.detail || err.message || 'Error fetching interfaces');
        setInterfaces([]);
      } finally {
        setInterfacesLoading(false);
      }
    };

    fetchInterfaces();
  }, [selectedDevice, keycloak]);

  const enabled = device?.features?.telemetry?.interface_stats;

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '400px', overflowY: 'auto' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">Interface Statistics</h2>

        {!enabled && (
          <div className="zoom-buttons-container">
            <div className="headerButtons">
              <button
                className={`iconButton ${enabled ? 'active' : ''}`}
                onClick={handlePush}
                disabled={loading}
              >
                <IoPushOutline className="defaultIcon" />
                <IoPushSharp className="hoverIcon" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.9' }}>
        {!enabled ? (
          <div style={{ padding: "10px", color: "gray" }}>
            Interface statistics telemetry not enabled for this device.
          </div>
        ) : (
          <>
            {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

            {interfacesLoading ? (
              <div style={{ color: 'var(--spanTextColor)' }}>Loading interfaces...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                    <th style={{ padding: '10px 12px' }}>Interface</th>
                    <th style={{ padding: '10px 12px' }}>Oper Status</th>
                    <th style={{ padding: '10px 12px' }}>Rx kbps</th>
                    <th style={{ padding: '10px 12px' }}>Rx pps</th>
                    <th style={{ padding: '10px 12px' }}>Tx kbps</th>
                    <th style={{ padding: '10px 12px' }}>Tx pps</th>
                  </tr>
                </thead>
                <tbody>
                  {interfaces
                    .filter(intf => intf.name && intf.name.trim() !== "")
                    .map((intf, idx) => {
                      const isReady = intf.status?.toLowerCase() === "if-oper-state-ready";
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid #eee", height: "42px" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "8px 10px" }}>{intf.name}</td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "20px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "white",
                              backgroundColor: isReady ? "#4CAF50" : "#E74C3C",
                              boxShadow: isReady
                                ? "0 0 8px rgba(76,175,80,0.6)"
                                : "0 0 8px rgba(231,76,60,0.6)"
                            }}>
                              {isReady ? "READY" : "DOWN"}
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px" }}>{intf.rx_kbps || "--"} kbps</td>
                          <td style={{ padding: "8px 10px" }}>{intf.rx_pps || "--"} pps</td>
                          <td style={{ padding: "8px 10px" }}>{intf.tx_kbps || "--"} kbps</td>
                          <td style={{ padding: "8px 10px" }}>{intf.tx_pps || "--"} pps</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InterfaceStatistics;
