import { useState, useEffect } from 'react';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import CpuUtilization from './CpuUtilization';
import MemoryStatistics from './MemoryStatistics';
import { pushConfiguration } from '../../hooks/pushConfiguration';

function SystemUtilization({ keycloak, selectedDevice, onSuccess, showNotification }) {
  const [device, setDevice] = useState(selectedDevice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync when selectedDevice changes
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
        featureKey: "system_util",
        endpoint: "system_util",
        showNotification
      });

      // Optimistic UI update (nested telemetry)
      setDevice(prev => ({
        ...prev,
        features: {
          ...prev.features,
          telemetry: {
            ...prev.features.telemetry,
            system_util: true
          }
        }
      }));

      onSuccess?.();
    } catch (err) {
      setError(err?.message || 'Failed to configure system utilization');
    } finally {
      setLoading(false);
    }
  };

  const enabled = device?.features?.telemetry?.system_util;

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '450px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">System Utilization</h2>

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

      <div
        style={{
          display: "flex",
          padding: '8px',
          marginLeft: '15px',
          fontSize: '14px',
          color: 'var(--textColor)',
          opacity: '0.9'
        }}
      >
        {loading ? (
          <div style={{ padding: "10px", color: "gray" }}>
            Configuring system utilization<span className="dot-flash">...</span>
          </div>
        ) : enabled ? (
          <>
            <CpuUtilization
              keycloak={keycloak}
              selectedDevice={device}
              showNotification={showNotification}
            />
            <MemoryStatistics
              keycloak={keycloak}
              selectedDevice={device}
              showNotification={showNotification}
            />
          </>
        ) : (
          <div style={{ padding: "10px", color: "gray" }}>
            System utilization telemetry not enabled for this device.
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "red", marginTop: "10px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

export default SystemUtilization;
