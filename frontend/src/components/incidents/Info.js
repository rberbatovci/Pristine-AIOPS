import React, { useState } from 'react';
import '../../css/SignalInfo.css';
import { HiOutlineLockClosed, HiLockClosed  } from "react-icons/hi";
import { RiCloseCircleLine, RiCloseCircleFill } from "react-icons/ri";
import { FormatDate } from '../misc/FormatDate';
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import apiClient from '../misc/AxiosConfig';

const Info = ({ currentUser, selectedIncident, correlatedSyslogs, onIncidentDeselect }) => {
  const correlatedSyslogsCount = correlatedSyslogs ? correlatedSyslogs.length : 0;
  const [showData, setShowData] = useState(true);


  const deselectSignal = () => {
    onIncidentDeselect(true);
  }

  console.log('currentUser in signalInfo:', currentUser);
  console.log('Selected Signal startTime and endTime in SignalInfo: ', selectedIncident.startTime, selectedIncident.endTime);

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Signal Info
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons">
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
                          <p>{selectedIncident.id} - {selectedIncident.state}</p>
                        </div>
                        <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
                          <p style={{ textAlign: 'right', width: '100px', marginRight: '10px', marginTop: '8px'  }}>Start Time:</p>
                          <p>{FormatDate(selectedIncident.startTime, currentUser.timezone)}</p>
                        </div>
                        <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
                          <p style={{ textAlign: 'right', width: '100px', marginRight: '10px', marginTop: '8px'  }}>End Time:</p>
                          <p>{FormatDate(selectedIncident.endTime || new Date(), currentUser.timezone)}</p>
                        </div>
                        <div style={{ display: 'flex', fontSize: '14px', color: 'var(--text-color)' }}>
                          <p style={{ textAlign: 'right', width: '100px', marginRight: '10px', marginTop: '8px'  }}>Events:</p>
                          <p>({correlatedSyslogsCount} events received)</p>
                        </div>
          </div>
  
          {/* Center Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          </div>
  
          {/* Right Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          </div>
        </div>
      )}
    </div>
  );
};

export default Info;
