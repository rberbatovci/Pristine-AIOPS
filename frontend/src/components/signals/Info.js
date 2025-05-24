import React, { useState } from 'react';
import '../../css/SignalInfo.css';
import { HiOutlineLockClosed, HiLockClosed } from "react-icons/hi";
import { RiCloseCircleLine, RiCloseCircleFill } from "react-icons/ri";
import { FormatDate } from '../misc/FormatDate';
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import apiClient from '../misc/AxiosConfig';

const Info = ({ currentUser, selectedSignal, correlatedSyslogs, onSignalDeselect }) => {
  const correlatedSyslogsCount = correlatedSyslogs ? correlatedSyslogs.length : 0;
  const [showData, setShowData] = useState(true);


  const closeSignal = async () => {
    try {
      const response = await apiClient.patch(`/signals/api/${selectedSignal.id}/closeSignal/`);
      if (response.status === 200) {
        alert('Signal closed successfully!');
        // Refresh or update the UI as needed
      }
    } catch (error) {
      console.error('Error closing signal:', error);
      alert('Failed to close signal.');
    }
  };

  const deleteSignal = async () => {
    try {
      const response = await apiClient.delete(`/signals/api/${selectedSignal.id}/`);
      if (response.status === 204) {
        alert('Signal deleted successfully!');
        onSignalDeselect(true); // Deselect signal after deletion
      }
    } catch (error) {
      console.error('Error deleting signal:', error);
      alert('Failed to delete signal.');
    }
  };

  const deselectSignal = () => {
    onSignalDeselect(true);
  }

  console.log('currentUser in signalInfo:', currentUser);
  console.log('Selected Signal startTime and endTime in SignalInfo: ', selectedSignal.startTime, selectedSignal.endTime);

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`} style={{ maxHeight: '180px' }}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Signal Info
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons">
              <button className="iconButton" onClick={deleteSignal}>
                <MdOutlineDeleteForever className="defaultIcon" />
                <MdDeleteForever className="hoverIcon" />
              </button>
              <button className="iconButton" onClick={closeSignal}>
                <HiOutlineLockClosed className="defaultIcon" />
                <HiLockClosed className="hoverIcon" />
              </button>
              <button className="iconButton" onClick={deselectSignal}>
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
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Signal ID:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>#{selectedSignal.id} - {selectedSignal.status}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>Start Time:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{FormatDate(selectedSignal.startTime, currentUser.timezone)}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '120px', marginRight: '10px' }}>End Time:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{FormatDate(selectedSignal.endTime || new Date(), currentUser.timezone)}</p>
            </div>
          </div>

          {/* Center Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '110px', marginRight: '10px' }}>Rule:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedSignal.rule}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '110px', marginRight: '10px' }}>Mnemonics:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedSignal.mnemonics}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '110px', marginRight: '10px' }}>Events:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>({correlatedSyslogsCount} events received)</p>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
              <p style={{ textAlign: 'right', width: '100px', marginRight: '10px' }}>Hostname:</p>
              <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedSignal.device}</p>
            </div>
            {selectedSignal.affectedEntities && Object.keys(selectedSignal.affectedEntities).length > 0 ? (
              Object.keys(selectedSignal.affectedEntities).map((key) => (
                <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
                  <p style={{ textAlign: 'right', width: '100px', marginRight: '10px' }}>{key}:</p>
                  <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>{selectedSignal.affectedEntities[key]}</p>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', fontSize: '13px', color: 'var(--text-color2)', marginTop: '4px' }}>
                <p style={{ textAlign: 'right', width: '100px', marginRight: '10px' }}>Affected Entities:</p>
                <p style={{ textAlign: 'left', width: '100px', marginRight: '10px', marginTop: '0px' }}>No Affected Entities</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Info;
