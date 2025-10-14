import { useState, useEffect } from 'react';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import apiClient from '../misc/AxiosConfig';

function IsisStats({ selectedDevice, onSuccess, showNotification }) {
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
    showNotification(`Configuring ISIS statistics telemetry on ${selectedDevice.hostname}...`, "loading");
    try {
      const response = await apiClient.post(
        `/devices/${selectedDevice.hostname}/configure/isis_stats/`,
        {}
      );
      showNotification(`ISIS statistics telemetry telemetry configured on ${selectedDevice.hostname}`, "info");
    } catch (err) {
      showNotification(`Error configuring ISIS statistics telemetry telemetry on ${selectedDevice.hostname}`, "error");
    }
  };

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '450px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">ISIS Statistics</h2>
        <div className="zoom-buttons-container">
          <div className="headerButtons">
            <button
              className={`iconButton ${selectedDevice.features?.telemetry?.isis_stats ? 'active' : ''}`}
              onClick={pushConfiguration()}>
              <IoPushOutline className="defaultIcon" />
              <IoPushSharp className="hoverIcon" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex" }}>
        {selectedDevice?.features?.telemetry?.isis_stats ? (
          <>
          </>
        ) : (
          <div style={{ padding: "10px", color: "gray" }}>
            ISIS statistics telemetry not enabled for this device.
          </div>
        )}
      </div>
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
    </div>
  );
}

export default IsisStats;
