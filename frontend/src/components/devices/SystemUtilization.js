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



  const enabled = device?.features?.telemetry?.features?.system_util;

  return (
    <div  style={{ maxHeight: '200px', marginTop: '10px', marginBottom: '10px' }}> 
      <div
        style={{
          display: "flex", 
          fontSize: '14px',
          color: 'var(--textColor)', 
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
