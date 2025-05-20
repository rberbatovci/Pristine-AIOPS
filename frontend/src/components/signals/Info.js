import React, { useState } from 'react';
import '../../css/SignalInfo.css';
import { HiOutlineLockClosed, HiLockClosed  } from "react-icons/hi";
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
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
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
                <HiOutlineLockClosed className="defaultIcon"/>
                <HiLockClosed className="hoverIcon"/>
              </button>
              <button className="iconButton" onClick={deselectSignal}>
                <RiCloseCircleLine className="defaultIcon"/>
                < RiCloseCircleFill className="hoverIcon"/>
              </button>
            </div>
          </div>
        )}
      </div>
  
      {showData && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px'}}>
          {/* Left Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '100px', fontWeight: '550', marginRight: '10px', marginTop: '8px' }}>Signal ID:</p>
              <p>{selectedSignal.id} - {selectedSignal.state}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '100px', marginRight: '10px', marginTop: '8px'  }}>Start Time:</p>
              <p>{FormatDate(selectedSignal.startTime, currentUser.timezone)}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '100px', marginRight: '10px', marginTop: '8px'  }}>End Time:</p>
              <p>{FormatDate(selectedSignal.endTime || new Date(), currentUser.timezone)}</p>
            </div>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '100px', marginRight: '10px', marginTop: '8px'  }}>Events:</p>
              <p>({correlatedSyslogsCount} events received)</p>
            </div>
          </div>
  
          {/* Center Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {selectedSignal.source === "stateful" && (
              <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
                <p style={{ textAlign: 'right', width: '200px', marginRight: '10px', marginTop: '8px' }}>Rule:</p>
                <p>{selectedSignal.rule}</p>
              </div>
            )}
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '200px', marginRight: '10px', marginTop: '8px' }}>Mnemonics:</p>
              <p>{selectedSignal.mnemonics}</p>
            </div>
          </div>
  
          {/* Right Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
              <p style={{ textAlign: 'right', width: '200px', marginRight: '10px', marginTop: '8px' }}>Hostname:</p>
              <p>{selectedSignal.device}</p>
            </div>
            {selectedSignal.affectedEntity && Object.keys(selectedSignal.affectedEntity).length > 0 ? (
              Object.keys(selectedSignal.affectedEntity).map((key) => (
                <div key={key} style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
                  <p style={{ textAlign: 'right', width: '200px', marginRight: '10px', marginTop: '8px' }}>{key}:</p>
                  <p>{selectedSignal.affectedEntity[key]}</p>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
                <p style={{ textAlign: 'right', width: '200px', marginRight: '10px', marginTop: '8px' }}>Affected Entities:</p>
                <p>No Affected Entities</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Info;
