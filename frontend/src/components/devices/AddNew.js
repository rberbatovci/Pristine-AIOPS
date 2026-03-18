import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import { TailSpin } from 'react-loader-spinner';
import kcFetch from '../misc/kcFetch';

function AddNewDevice({ onDeviceAdded, keycloak }) {
  const [ipAddress, setIpAddress] = useState('');
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, SetLoading] = useState(false);

  const handleClear = () => {
    setIpAddress('');
    setHostname('');
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async () => {
    SetLoading(true);
    setError('');
    setSuccess(false);

    if (!ipAddress || !hostname ) {
      setError('Please fill in all required fields.');
      SetLoading(false); // important to stop loading
      return;
    }

    try {
      const payload = {
        ip_address: ipAddress,
        hostname: hostname,
      };

      const res = await kcFetch(keycloak, "/devices/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(true);
      if (onDeviceAdded) onDeviceAdded(res);

      handleClear();
    } catch (err) {
      console.error(err);
      setError('Failed to add device. Make sure the hostname is unique.');
    } finally {
      SetLoading(false);
    }
  };

  return (
    <div className="searchSyslogsContainer">
      <span className="searchSignalFilterText">Add a new device</span>
      <div className="searchSyslogsFilterEntries" style={{ marginTop: '-10px' }}>
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
      </div>

      <div className="searchButtonContainer">
        <button
          onClick={handleSubmit}
          className="addRuleButton"
          style={{
            width: '100%',
            backgroundColor: success
              ? 'green'
              : error
                ? 'red'
                : '',
          }}
        >
          {loading ? (
            <TailSpin height={16} width={16} color="#fff" />
          ) : success ? (
            'Added!'
          ) : error ? (
            'Error'
          ) : (
            'Save'
          )}
        </button>
      </div>
    </div>
  );
}

export default AddNewDevice;
