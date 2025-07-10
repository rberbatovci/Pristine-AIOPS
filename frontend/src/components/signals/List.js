import React, { useState } from 'react';
import '../../css/SignalsList.css';

function List({ onSignalSelect, signals }) {
  const [selectedSignal, setSelectedSignal] = useState(null);

  // Handle selecting or deselecting a signal
  const handleSignalClick = (signal) => {
    // Select the signal
    console.log(`Signal selected with ID: ${signal}`);
    setSelectedSignal(signal);
    onSignalSelect(signal); // Pass the selected signal's ID to the parent
  };

  // Format the date into a readable string
  const formatDate = (date) => new Date(date).toLocaleString();

  // Calculate the duration since the start time
  const getDuration = (startTime) => {
    const start = new Date(startTime);
    const now = new Date();
    const duration = Math.abs(now - start) / 1000;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // Return alert color based on signal state
  const getAlertColor = (state) => {
    switch (state) {
      case 'open':
        return 'red';
      case 'closed':
        return 'green';
      default:
        return 'yellow';
    }
  };

  return (
    <div className="signals-list-container">
      <ul className="signals-list" style={{ paddingLeft: '0', listStyle: 'none' }}>
        {signals.map((signal) => (
          <li
            key={signal.id}
            onClick={() => handleSignalClick(signal)}
            className={`signalTagItem ${selectedSignal?.id === signal.id ? 'selected' : ''}`}
          >
            <div style={{ display: 'flex' }}>
              {/* Signal Badge */}
              <div className="signalBadge">
                <div
                  style={{
                    background: getAlertColor(signal.status),
                    height: '95%',
                    width: '20px',
                    position: 'relative',
                    top: '-2px',
                  }}
                />
              </div>

              {/* Signal ID and State */}
              <div  style={{ padding: '10px', alignContent: 'center', textAlign: 'center' }}>
                <div><strong className="strongText">ID: </strong><span className="spanText">#{signal.id}</span></div>
                <div><span className="spanText">{signal.status}</span></div>
                <div><span className="spanText">{signal.signalSource}</span></div>
              </div>

              {/* Signal Details */}
              <div className="signalDetails" style={{ paddingLeft: '10px' }}>
                <div><strong className="strongText">Hostname:</strong> <span className="spanText">{signal.device}</span></div>
                <div style={{ marginTop: '5px', fontSize: '12px' }}>
                  <strong className="strongText">Source:</strong> <span className="spanText">{signal.mnemonics}</span>
                  <strong className="strongText" style={{ marginLeft: '10px' }}>Rule:</strong> <span className="spanText">{signal.rule}</span>
                </div>
                <div style={{ marginTop: '5px', fontSize: '12px', display: 'flex' }}>
                  {signal.affectedEntities && Object.keys(signal.affectedEntities).length > 0 ? (
                    Object.keys(signal.affectedEntities).map((key) => (
                      <div key={key} style={{ marginRight: '10px' }}>
                        <strong className="strongText">{key}:</strong> <span className="spanText">{signal.affectedEntities[key]}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', marginTop: '5px' }}>
                      <strong className="strongText">Affected Entities:</strong> <span className="spanText">No Affected Entities</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signal Time */}
              <div className="signalTime">
                <span className="signalTime-item"><strong>Start Time:</strong> {formatDate(signal.startTime)}</span>
                {signal.status === 'closed' ? (
                  <span className="signalTime-item"><strong>End Time:</strong> {formatDate(signal.endTime)}</span>
                ) : (
                  <span className="signalTime-item"><strong>Duration:</strong> {getDuration(signal.startTime)}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default List;
