import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles';

const vendorOptions = [
  { value: 'cisco', label: 'Cisco' },
  { value: 'juniper', label: 'Juniper' },
  { value: 'arista', label: 'Arista' },
  // Add more as needed
];

const versionOptions = [
  { value: 'ios-xe', label: 'IOS XE' },
  { value: 'ios-xr', label: 'IOS XR' },
  { value: 'junos', label: 'JUNOS' },
  // Add more as needed
];

function AddNewDevice({ onDeviceAdded }) {
  const [ipAddress, setIpAddress] = useState('');
  const [hostname, setHostname] = useState('');
  const [vendor, setVendor] = useState(null);
  const [version, setVersion] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleClear = () => {
    setIpAddress('');
    setHostname('');
    setVendor(null);
    setVersion(null);
    setError('');
    setSuccess(false);
  };

  useEffect(() => {
    setVendor(vendorOptions.find(option => option.value === 'cisco'));
    setVersion(versionOptions.find(option => option.value === 'ios-xe'));
  }, []);

  const handleSubmit = async () => {
    setError('');
    setSuccess(false);

    if (!ipAddress || !hostname || !vendor) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        ip_address: ipAddress,
        hostname: hostname,
        vendor: vendor.value,
        version: version?.value || null,
      };

      const res = await apiClient.post('/devices/', payload);

      setSuccess(true);
      if (onDeviceAdded) {
        onDeviceAdded(res.data);
      }

      handleClear(); // Optionally clear form after submit
    } catch (err) {
      setError('Failed to add device. Make sure the hostname is unique.');
    }
  };

  return (
    <div className="searchSyslogsContainer">
      <span className="searchSignalFilterText">Add a new device</span>
      <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Agent IP address:</span>
          <div style={{ marginTop: '6px', width: '300px' }}>
            <input
              placeholder="IP Address"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="inputText"
              style={{ width: '320px' }}
            />
          </div>
        </div>

        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Agent hostname:</span>
          <div style={{ marginTop: '6px' }}>
            <input
              placeholder="Hostname"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="inputText"
              style={{ width: '320px' }}
            />
          </div>
        </div>

        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Agent vendor:</span>
          <div style={{ marginTop: '6px' }}>
            <Select
              placeholder="Vendor"
              options={vendorOptions}
              value={vendor}
              onChange={setVendor}
              styles={customStyles('325px')}
              isDisabled={true}
            />
          </div>
        </div>

        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">Agent version:</span>
          <div style={{ marginTop: '6px' }}>
            <Select
              placeholder="Version"
              options={versionOptions}
              value={version}
              onChange={setVersion}
              styles={customStyles('325px')}
              isDisabled={true}
            />
          </div>
        </div>
      </div>

      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginTop: '10px' }}>Device added successfully!</div>}

      <div className="searchButtonContainer">
        <button onClick={handleSubmit} className="searchButton">
          Add Device
        </button>
      </div>
    </div>
  );
}

export default AddNewDevice;
