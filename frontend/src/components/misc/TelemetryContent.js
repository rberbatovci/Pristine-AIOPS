import React, { useState } from 'react';
import '../../css/EventsTable.css'; // Assuming this contains general table styling

// Telemetry components
import BGPStats from '../telemetry/BGPStats.js';
import CPUUtilsStats from '../telemetry/CPUUtilsStats.js';
import InterfaceStats from '../telemetry/InterfaceStats.js';
import MemoryStats from '../telemetry/MemoryStats.js';
import ISISStats from '../telemetry/ISISStats.js';

const TelemetryContent = ({ currentUser, selectedDevice }) => {
  const [filterValues, setFilterValues] = useState({});

  return (
    <div
      className="telemetryGridContainer"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        height: '100%',
        maxHeight: 'calc(100vh - 140px)',
        overflowY: 'auto',
        padding: '0px',
        border: '1px solid var(--borderColor)',
        borderRadius: '10px',
      }}
    >
      <CPUUtilsStats selectedDevice={selectedDevice} />
      <MemoryStats selectedDevice={selectedDevice} />
      <InterfaceStats selectedDevice={selectedDevice} />
      <ISISStats selectedDevice={selectedDevice} />
      <BGPStats selectedDevice={selectedDevice} />
      <InterfaceStats selectedDevice={selectedDevice} />
    </div>
  );
};

export default TelemetryContent;
