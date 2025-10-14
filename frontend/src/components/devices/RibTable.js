import { useState, useEffect } from 'react';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import CpuUtilization from './CpuUtilization';
import MemoryStatistics from './MemoryStatistics';
import apiClient from '../misc/AxiosConfig';

function RibTable({ selectedDevice, onSuccess, showNotification }) {
  const [device, setDevice] = useState(selectedDevice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Memory
  useEffect(() => setDevice(selectedDevice), [selectedDevice]);

  const pushConfiguration = () => async () => {
    if (!selectedDevice?.hostname) {
      console.error("No device selected");
      return;
    }
    showNotification(`Configuring RIB table telemetry on ${selectedDevice.hostname}...`, "loading");
    try {
      const response = await apiClient.post(
        `/devices/${selectedDevice.hostname}/configure/rib_table/`,
        {}
      );
      showNotification(`RIB table telemetry telemetry configured on ${selectedDevice.hostname}`, "info");
    } catch (err) {
      showNotification(`Error configuring RIB table telemetry telemetry on ${selectedDevice.hostname}`, "error");
    }
  };

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '450px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">RIB table</h2>
        <div className="zoom-buttons-container">
          <div className="headerButtons">
            <button
              className={`iconButton ${selectedDevice.features?.telemetry?.rib_table ? 'active' : ''}`}
              onClick={pushConfiguration()}>
              <IoPushOutline className="defaultIcon" />
              <IoPushSharp className="hoverIcon" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex" }}>
        {selectedDevice?.features?.telemetry?.rib_table ? (
          <>
          </>
        ) : (
          <div style={{ padding: "10px", color: "gray" }}>
            RIB table telemetry not enabled for this device.
          </div>
        )}
      </div>
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
    </div>
  );
}

export default RibTable;
