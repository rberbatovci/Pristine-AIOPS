import React, { useState } from 'react';
import '../../css/SignalInfo.css';
import { RiCloseCircleLine, RiCloseCircleFill } from "react-icons/ri";
import apiClient from '../misc/AxiosConfig';

const Info = ({ currentUser, selectedDevice, onDeviceDeselect }) => {
  const [showData, setShowData] = useState(true);
  const [editedHostname, setEditedHostname] = useState(selectedDevice.hostname);
  const [isEditing, setIsEditing] = useState(false);

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

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Signal Info
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons">
              <button className="iconButton" onClick={deselectDevice}>
                <RiCloseCircleLine className="defaultIcon" />
                < RiCloseCircleFill className="hoverIcon" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showData && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
          {/* Left Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '100px', fontWeight: '550', marginRight: '10px', marginTop: '8px' }}>Device IP:</p>
              <p>{selectedDevice.ip_address}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '100px', fontWeight: '550', marginRight: '10px', marginTop: '8px' }}>Hostname:</p>
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
            </div>
          </div>
          {/* Center Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}></div>
          {/* Right Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}></div>
        </div>
      )}
    </div>
  );
};

export default Info;
