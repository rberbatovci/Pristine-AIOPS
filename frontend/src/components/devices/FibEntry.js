import { useState, useEffect } from 'react';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import apiClient from '../misc/AxiosConfig';

function FibEntry({ selectedDevice, onSuccess, showNotification }) {
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
    showNotification(`Configuring FIB entry telemetry on ${selectedDevice.hostname}...`, "loading");
    try {
      const response = await apiClient.post(
        `/devices/${selectedDevice.hostname}/configure/fib_entry/`,
        {}
      );
      showNotification(`FIB entry telemetry telemetry configured on ${selectedDevice.hostname}`, "info");
    } catch (err) {
      showNotification(`Error configuring FIB entry telemetry telemetry on ${selectedDevice.hostname}`, "error");
    }
  };

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '450px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">FIB entry</h2>
        <div className="zoom-buttons-container">
          <div className="headerButtons">
            <button
              className={`iconButton ${selectedDevice.features?.telemetry?.fib_entry ? 'active' : ''}`}
              onClick={pushConfiguration()}>
              <IoPushOutline className="defaultIcon" />
              <IoPushSharp className="hoverIcon" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: "flex" }}>
        {selectedDevice?.features?.telemetry?.fib_entry ? (
          <>
          </>
        ) : (
          <div style={{ padding: "10px", color: "gray" }}>
            FIB entry telemetry not enabled for this device.
          </div>
        )}
      </div>
      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
    </div>
  );
}

export default FibEntry;
