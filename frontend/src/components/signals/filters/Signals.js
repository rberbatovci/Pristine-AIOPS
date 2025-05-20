import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';
import apiClient from '../../misc/AxiosConfig';

const Signals = ({ onSearch = () => {} }) => {
  const [filters, setFilters] = useState({
    state: [],
    source: [],
    severity: [],
    dateRange: [null, null],
    hostname: [], // Allow multiple hostnames
  });

  const [hostnames, setHostnames] = useState([]); // State to store device hostnames

  const signalstates = [
    { value: 'warmup', label: 'Warmup' },
    { value: 'open', label: 'Open' },
    { value: 'cooldown', label: 'Cooldown' },
    { value: 'closed', label: 'Closed' },
  ];

  const severities = [
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  useEffect(() => {
    // Fetch device hostnames on component mount
    apiClient
      .get('/devices/brief') // Replace with your actual endpoint for hostnames
      .then((response) => {
        const fetchedHostnames = response.data.map((device) => ({
          value: device.hostname,
          label: device.hostname,
        }));
        setHostnames(fetchedHostnames);
      })
      .catch((error) => {
        console.error('Error fetching hostnames:', error);
      });
  }, []);

  const handleMultiSelectChange = (selectedOptions, filterKey) => {
    const updatedFilters = {
      ...filters,
      [filterKey]: selectedOptions ? selectedOptions.map((option) => option.value) : [],
    };
    setFilters(updatedFilters);
    onSearch(updatedFilters); // Apply changes immediately
  };

  const handleDateRangeChange = (dateRange) => {
    const updatedFilters = { ...filters, dateRange };
    setFilters(updatedFilters);
    onSearch(updatedFilters); // Apply changes immediately
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
        <div style={{ marginRight: '15px' }}>
          <span>Hostname:</span>
          <Select
            isMulti
            options={hostnames}
            onChange={(selected) => handleMultiSelectChange(selected, 'hostname')}
            value={hostnames.filter((host) => filters.hostname.includes(host.value))}
            styles={customStyles}
            placeholder="Select Hostname"
          />
        </div>
        <div style={{ marginRight: '15px' }}>
          <span>Source:</span>
          <Select
            isMulti
            options={[
              { value: 'syslogs', label: 'Syslogs' },
              { value: 'snmptraps', label: 'SNMP Traps' },
              { value: 'telemetry', label: 'Telemetry' },
            ]}
            onChange={(selected) => handleMultiSelectChange(selected, 'source')}
            value={[
              { value: 'syslogs', label: 'Syslogs' },
              { value: 'snmptraps', label: 'SNMP Traps' },
              { value: 'telemetry', label: 'Telemetry' },
            ].filter((source) => filters.source.includes(source.value))}
            styles={customStyles}
            placeholder="Select Source"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
        <div style={{ marginRight: '15px', width: '50%' }}>
          <span>Severity:</span>
          <Select
            isMulti
            options={severities}
            onChange={(selected) => handleMultiSelectChange(selected, 'severity')}
            value={severities.filter((severity) => filters.severity.includes(severity.value))}
            styles={customStyles}
            placeholder="Select Severity"
          />
        </div>
        <div style={{ marginRight: '15px' }}>
          <span>State:</span>
          <Select
            isMulti
            options={signalstates}
            onChange={(selected) => handleMultiSelectChange(selected, 'state')}
            value={signalstates.filter((state) => filters.state.includes(state.value))}
            styles={customStyles}
            placeholder="Select State"
          />
        </div>
      </div>

      <div style={{ marginTop: '5px', marginRight: '15px' }}>
        <span>Date Range:</span>
        
      </div>
    </div>
  );
};

export default Signals;
