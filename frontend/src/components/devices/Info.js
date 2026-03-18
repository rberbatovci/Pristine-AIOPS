import { useState } from 'react';
import '../../css/SignalInfo.css';
import { RiCloseCircleLine, RiCloseCircleFill } from "react-icons/ri";
import kcFetch from '../misc/kcFetch';
import { PiTerminalDuotone, PiTerminalFill } from "react-icons/pi";
import { RiStackshareLine, RiStackshareFill } from "react-icons/ri";
import { PiSwapFill, PiSwapDuotone } from "react-icons/pi";
import { RiDeleteBin2Line, RiDeleteBin2Fill } from "react-icons/ri";
import { RiShieldKeyholeLine, RiShieldKeyholeFill } from "react-icons/ri";


const Info = ({ currentUser, selectedDevice, onDeviceDeselect, onConfig, onDeviceDelete, showNotification, keycloak }) => {
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

  const deleteDevice = async () => {

    if (!window.confirm(`Are you sure you want to delete ${selectedDevice.hostname}?`)) return;

    try {
      await kcFetch(
        keycloak,
        `/devices/${selectedDevice.hostname}`,
        { method: "DELETE" }
      );

      onDeviceDeselect(true);
      onDeviceDelete(selectedDevice.id);
      showNotification("Device deleted successfully", "success");
    } catch (err) {
      if (err.status === 403) {
        showNotification("You are not authorized to delete devices", "error");
      } else {
        showNotification("Failed to delete device", "error");
      }
    }
  };

  const pushConfiguration = (featureName) => async () => {
    if (!selectedDevice?.hostname) {
      showNotification("No device selected", "error");
      return;
    }

    // Define messages for different features
    const messages = {
      syslogs: {
        loading: `Configuring syslogs on ${selectedDevice.hostname}...`,
        success: `Syslogs configuration applied successfully on ${selectedDevice.hostname}.`,
        error: `Failed to apply syslogs configuration on ${selectedDevice.hostname}.`,
      },
      snmp_traps: {
        loading: `Configuring SNMP Traps on ${selectedDevice.hostname}...`,
        success: `SNMP Traps configuration applied successfully on ${selectedDevice.hostname}.`,
        error: `Failed to apply SNMP Traps configuration on ${selectedDevice.hostname}.`,
      },
      netflow: {
        loading: `Configuring Netflow/IPFIX on ${selectedDevice.hostname}...`,
        success: `Netflow/IPFIX configuration applied successfully on ${selectedDevice.hostname}.`,
        error: `Failed to apply Netflow/IPFIX configuration on ${selectedDevice.hostname}.`,
      },
      default: {
        loading: `Configuring ${featureName} on ${selectedDevice.hostname}...`,
        success: `Successfully pushed configuration for ${featureName} on ${selectedDevice.hostname}.`,
        error: `Error configuring ${featureName} on ${selectedDevice.hostname}.`,
      },
    };

    const msg = messages[featureName] || messages.default;

    // Show loading notification
    showNotification(msg.loading, "loading");

    try {
      const response = await kcFetch(
        keycloak,
        `/devices/${selectedDevice.hostname}/configure/${featureName}/`,
        { method: "POST" }
      );

      showNotification("Configuration applied successfully", "success");
    } catch (err) {
      if (err.status === 403) {
        showNotification("You are not authorized to configure devices", "error");
      } else {
        showNotification("Configuration failed", "error");
      }
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
            <button className="iconButton" >
              <RiShieldKeyholeLine className="defaultIcon" />
              <RiShieldKeyholeFill className="hoverIcon" />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', color: 'var(--spanTextColor)', opacity: '0.8', height: '200px' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px',  height: '25px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Health:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px' }}># Device Health</p>
          </div>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px',  height: '25px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Vendor:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px' }}>{selectedDevice.vendor}</p>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px',  height: '25px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>IP Address:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px' }}>{selectedDevice.ip_address}</p>
          </div>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px',  height: '25px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Version:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px' }}>{selectedDevice.version}</p>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: '13px', marginTop: '4px',  height: '25px' }}>
            <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Hostname:</p>
            <p style={{ textAlign: 'left', width: '100px', marginRight: '10px' }}>{selectedDevice.hostname}</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Info;
