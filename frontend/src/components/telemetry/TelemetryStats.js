import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import apiClient from '../misc/AxiosConfig';
import '../../css/SearchSyslogs.css';
import customStyles from '../misc/SelectStyles';

const TelemetryStats = ({ devices, onDeviceSelect }) => {
  const [selectedOption, setSelectedOption] = useState(null);

  const deviceOptions = devices.map(device => ({
    value: device.hostname,
    label: device.hostname,
    deviceObj: device,
  }));

  const handleDeviceChange = (option) => {
    setSelectedOption(option); // Update local selected option
    onDeviceSelect(option?.value || null); // Pass the hostname (value) to parent
  };

  // If devices change, and selected option is no longer valid, reset selection
  useEffect(() => {
    if (selectedOption && !devices.find(d => d.hostname === selectedOption.value)) {
      setSelectedOption(null);
    }
  }, [devices]);

  return (
    <div className="searchSyslogsContainer">
      <div className="searchSyslogsFilterEntries">
        <span className="searchSignalFilterText">Device:</span>
        <div style={{ marginTop: '6px' }}>
          <Select
            options={deviceOptions}
            onChange={handleDeviceChange}
            value={selectedOption}
            placeholder="Select device"
            isClearable
            styles={{
              ...customStyles('380px'),
              menuPortal: (base) => ({ ...base, zIndex: 9999 }),
            }}
            menuPortalTarget={document.body}
          />
        </div>
      </div>
    </div>
  );
};

export default TelemetryStats;
