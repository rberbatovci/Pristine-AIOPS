import React, { useState } from 'react';
import '../../css/SignalInfo.css';
import { RiCloseCircleLine, RiCloseCircleFill } from "react-icons/ri";
import apiClient from '../misc/AxiosConfig';
import { IoAnalyticsOutline } from "react-icons/io5";
import { IoMdAnalytics } from "react-icons/io";
import { PiTerminalDuotone, PiTerminalFill } from "react-icons/pi";
import { RiStackshareLine, RiStackshareFill } from "react-icons/ri";
import { PiSwapFill, PiSwapDuotone } from "react-icons/pi";
import { RiDeleteBin2Line, RiDeleteBin2Fill } from "react-icons/ri";
import NetflowConfig from './NetflowConfig';
import SyslogConfig from './SyslogConfig';
import SnmpTrapConfig from './SnmpTrapConfig';
import TelemetryConfig from './TelemetryConfig';

const Info = ({ currentUser, selectedDevice, onDeviceDeselect, onConfigClick, onDeviceDelete }) => {
  const [editedHostname, setEditedHostname] = useState(selectedDevice.hostname);
  const [isEditing, setIsEditing] = useState(false);
  const [dropdowns, setDropdowns] = useState({
    syslogs: { visible: false, position: { x: 0, y: 0 } },
    snmpTraps: { visible: false, position: { x: 0, y: 0 } },
    netflow: { visible: false, position: { x: 0, y: 0 } },
    telemetry: { visible: false, position: { x: 0, y: 0 } },
  });
  const hostname = selectedDevice.hostname;
  const version = selectedDevice.version;
  console.log('Selected Hostname and version in Info component:', hostname, version);

  const deselectDevice = () => {
    onDeviceDeselect(true);
  };

  const updateHostname = async () => {
    try {
      const response = await apiClient.put(`/devices/devices/${selectedDevice.id}/`, {
        hostname: editedHostname
      });
      console.log("Hostname updated:", response.data);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update hostname:", error);
    }
  };

  const deleteDevice = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedDevice.hostname}?`)) return;

    try {
      await apiClient.delete(`/devices/${selectedDevice.hostname}`);
      console.log("Device deleted successfully");
      onDeviceDeselect(true);
      onDeviceDelete(selectedDevice.id);
    } catch (error) {
      console.error("Failed to delete device:", error);
      alert("Failed to delete device. Please try again.");
    }
  };

const pushConfiguration = (featureName) => async () => {
  if (!selectedDevice?.hostname) {
    console.error("No device selected");
    return;
  }

  try {
    const response = await apiClient.post(
      `/devices/${selectedDevice.hostname}/configure/${featureName}/`,
      {} // empty body
    );

    const updatedDevice = response.data;
    console.log("Updated device:", updatedDevice);

    // Optionally update state
    // setSelectedDevice(updatedDevice);

  } catch (err) {
    console.error("Request error:", err);
    const message = err.response?.data?.detail || err.message || err;
    alert(`Error configuring ${featureName}: ${message}`);
  }
};

  return (
    <div className="signalRightElementContainer" style={{ maxHeight: '180px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt">
          Device Info
        </h2>
        <div className="zoom-buttons-container">
          <div className="headerButtons">
            <button
              className={`iconButton ${selectedDevice.features?.syslogs ? 'active' : ''}`}
              onClick={pushConfiguration('syslogs')}>
              <PiTerminalDuotone className="defaultIcon" />
              <PiTerminalFill className="hoverIcon" />
            </button>
            <button
              className={`iconButton ${selectedDevice.features?.snmp_traps ? 'active' : ''}`}
              onClick={pushConfiguration('snmp_traps')}>
              <RiStackshareLine className="defaultIcon" />
              <RiStackshareFill className="hoverIcon" />
            </button>
            <button
              className={`iconButton ${selectedDevice.features?.netflow ? 'active' : ''}`}
              onClick={pushConfiguration('netflow')}>
              <PiSwapFill className="defaultIcon" />
              <PiSwapDuotone className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={deleteDevice}>
              <RiDeleteBin2Line className="defaultIcon" />
              <RiDeleteBin2Fill className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={deselectDevice}>
              <RiCloseCircleLine className="defaultIcon" />
              <RiCloseCircleFill className="hoverIcon" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', color: 'var(--spanTextColor)', opacity: '0.8', height: '200px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Health:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}># Device Health</p>
          </div>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Vendor:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.vendor}</p>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>IP Address:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
          </div>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Version:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.version}</p>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Hostname:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.hostname}</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Info;
