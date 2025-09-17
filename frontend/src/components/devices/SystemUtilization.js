import { useState, useEffect } from 'react';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import CpuUtilization from './CpuUtilization';
import MemoryStatistics from './MemoryStatistics';

function SystemUtilization({ selectedDevice, onSuccess, showNotification }) {
    const [device, setDevice] = useState(selectedDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Memory
    useEffect(() => setDevice(selectedDevice), [selectedDevice]);

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '450px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">System Utilization</h2>
      </div>
      <div style={{ display: "flex" }}>
        <CpuUtilization selectedDevice={device} showNotification={showNotification}/>
        <MemoryStatistics selectedDevice={device} showNotification={showNotification}/>
      </div>
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
    </div>
  );
}

export default SystemUtilization;
