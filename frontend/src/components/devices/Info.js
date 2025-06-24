import React, { useState } from 'react';
import '../../css/SignalInfo.css';
import { RiCloseCircleLine, RiCloseCircleFill } from "react-icons/ri";
import apiClient from '../misc/AxiosConfig';
import { IoAnalyticsOutline } from "react-icons/io5";
import { IoMdAnalytics } from "react-icons/io";
import { PiTerminalDuotone, PiTerminalFill } from "react-icons/pi";
import { RiStackshareLine, RiStackshareFill } from "react-icons/ri";
import { PiSwapFill, PiSwapDuotone } from "react-icons/pi";
import NetflowConfig from './NetflowConfig';
import SyslogConfig from './SyslogConfig';
import SnmpTrapConfig from './SnmpTrapConfig';
import TelemetryConfig from './TelemetryConfig';

const Info = ({ currentUser, selectedDevice, onDeviceDeselect }) => {
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


  const handleButtonClick = (event, dropdownKey) => {
    const updatedDropdowns = Object.keys(dropdowns).reduce((acc, key) => {
      acc[key] = { ...dropdowns[key], visible: false };
      return acc;
    }, {});
    const newVisibility = !dropdowns[dropdownKey].visible;
    setDropdowns({
      ...updatedDropdowns,
      [dropdownKey]: {
        ...dropdowns[dropdownKey],
        visible: newVisibility,
      },
    });
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
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>
                {isEditing ? (
                <input
                  type="text"
                  value={editedHostname}
                  onChange={(e) => setEditedHostname(e.target.value)}
                  style={{ padding: '5px', fontSize: '14px' }}
                />
                
              ) : (
                <p>{selectedDevice.hostname}</p>
              )}
              <button
                onClick={() => isEditing ? updateHostname() : setIsEditing(true)}
                style={{ marginLeft: '10px', cursor: 'pointer' }}
              >
                {isEditing ? "Save" : "Edit"}
              </button>
              </p>
            </div>
          </div>
          {/* Center Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Syslogs:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>SNMP Traps:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}> Netflow:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
          </div>
          {/* Right Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>CPU Util:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Memory Stats:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Interface Stats:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedDevice.ip_address}</p>
            </div>
          </div>
          <div
            className={`dropdownMenu ${dropdowns.syslogs.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{ width: '420px', marginTop: '30px', right: '30px' }}
          >
            <SyslogConfig
              hostname={hostname}
              version={version}
            />
          </div>
          <div
            className={`dropdownMenu ${dropdowns.snmpTraps.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{ width: '420px', marginTop: '30px', right: '30px' }}
          >
            <SnmpTrapConfig
              hostname={hostname}
              version={version}
            />
          </div>
          <div
            className={`dropdownMenu ${dropdowns.netflow.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{ width: '420px', marginTop: '30px', right: '30px' }}
          >
            <NetflowConfig
              hostname={hostname}
              version={version}
            />
          </div>
          <div
            className={`dropdownMenu ${dropdowns.telemetry.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{ width: '420px', marginTop: '30px', right: '30px', position: 'absolute', zIndex: 1000 }}
          >
            <TelemetryConfig
              hostname={hostname}
              version={version}
            />
          </div>
        </div>

      )}
    </div>

  );
};

export default Info;
