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

const Info = ({ currentUser, selectedDevice, onDeviceDeselect, onConfigClick }) => {
  const [showData, setShowData] = useState(true);
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
      onDeviceDeselect(true);  // Notify parent to refresh or deselect
    } catch (error) {
      console.error("Failed to delete device:", error);
      alert("Failed to delete device. Please try again.");
    }
  };

  const handleButtonClick = (event, dropdownKey) => {
    if (onConfigClick) {
    onConfigClick(dropdownKey); 
  }
  };

  return ( 
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`} style={{ maxHeight: '180px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Device Info
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons">
              <button
                className={`iconButton ${dropdowns.syslogs.visible ? 'active' : ''}`}
                onClick={(event) => handleButtonClick(event, 'syslogs')}>
                <PiTerminalDuotone className="defaultIcon" />
                <PiTerminalFill className="hoverIcon" />
              </button>
              <button
                className={`iconButton ${dropdowns.snmpTraps.visible ? 'active' : ''}`}
                onClick={(event) => handleButtonClick(event, 'snmpTraps')}>
                <RiStackshareLine className="defaultIcon" />
                <RiStackshareFill className="hoverIcon" />
              </button>
              <button
                className={`iconButton ${dropdowns.netflow.visible ? 'active' : ''}`}
                onClick={(event) => handleButtonClick(event, 'netflow')}>
                <PiSwapFill className="defaultIcon" />
                <PiSwapDuotone className="hoverIcon" />
              </button>
              <button
                className={`iconButton ${dropdowns.telemetry.visible ? 'active' : ''}`}
                onClick={(event) => handleButtonClick(event, 'telemetry')}>
                <IoAnalyticsOutline className="defaultIcon" />
                <IoMdAnalytics className="hoverIcon" />
              </button>
              <button className="iconButton" onClick={deselectDevice}>
                <RiCloseCircleLine className="defaultIcon" />
                <RiCloseCircleFill className="hoverIcon" />
              </button>
              <button className="iconButton" onClick={deleteDevice}>
                <RiDeleteBin2Line className="defaultIcon" />
                <RiDeleteBin2Fill className="hoverIcon" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showData && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', color: 'var(--spanTextColor)', opacity: '0.8', height: '200px' }}>
          {/* Left Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Device IP:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Hostname:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.hostname}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Vendor:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.vendor}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Version:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.version}</p>
            </div>
          </div>
          {/* Center Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Syslogs:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.syslogs ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>SNMP Traps:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.snmp_traps ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}> Netflow:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.netflow ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
          {/* Right Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>CPU Util:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.telemetry?.cpu_util ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Memory Stats:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.telemetry?.memory_stats ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Interface Stats:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.telemetry?.interface_stats ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>BGP Connections:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.telemetry?.bgp_connections ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>ISIS Stats:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.features?.telemetry?.isis_stats ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
        </div>

      )}
    </div>

  );
};

export default Info;
