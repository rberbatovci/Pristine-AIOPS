import React, { useState } from 'react';
import '../../css/EventsTable.css'; // Assuming this contains general table styling

// Telemetry components
import BGPStats from '../telemetry/BGPStats.js';
import CPUUtilsStats from '../telemetry/CPUUtilsStats.js';
import InterfaceStats from '../telemetry/InterfaceStats.js';
import MemoryStats from '../telemetry/MemoryStats.js';
import ISISStats from '../telemetry/ISISStats.js';
import { NonceProvider } from 'react-select';

const TelemetryContent = ({ currentUser, selectedDevice }) => {
  const [filterValues, setFilterValues] = useState({});

  return (
    <div
    >
      <CPUUtilsStats selectedDevice={selectedDevice} />
      <MemoryStats selectedDevice={selectedDevice} />
      <InterfaceStats selectedDevice={selectedDevice} />
    </div>
  );
};

export default TelemetryContent;
