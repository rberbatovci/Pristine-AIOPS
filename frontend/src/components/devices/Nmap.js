import React, { useState } from 'react';
import { TailSpin } from 'react-loader-spinner';
import kcFetch from '../misc/kcFetch';

// ✅ CIDR validation function
const isValidCIDR = (value) => {
  const cidrRegex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/([0-9]|[1-2][0-9]|3[0-2])$/;

  return cidrRegex.test(value);
};

function Nmap({ onDeviceAdded, keycloak }) {
  const [ipAddress, setIpAddress] = useState('');
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const handleClear = () => {
    setIpAddress('');
    setHostname('');
    setError('');
    setSuccess(false);
    setIsValid(true);
  };

  // ✅ Live validation while typing
  const handleIpChange = (value) => {
    setIpAddress(value);

    if (value === '') {
      setIsValid(true);
    } else {
      setIsValid(isValidCIDR(value));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!ipAddress || !hostname) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    // ✅ Validate CIDR before sending
    if (!isValidCIDR(ipAddress)) {
      setError('Please enter a valid network (e.g. 10.10.1.0/24)');
      setLoading(false);
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
      setLoading(false);
    }
  };

  return (
    <div className="searchSyslogsContainer">
      <span className="searchSignalFilterText">Scan a network</span>

      <div className="searchSyslogsFilterEntries" style={{ marginTop: '-10px' }} >
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">
            Network address:
          </span>
          <div style={{ marginTop: '6px', width: '300px' }}>
            <input
              placeholder="e.g. 10.10.1.0/24"
              value={ipAddress}
              onChange={(e) => handleIpChange(e.target.value)}
              className="inputText"
              style={{
                width: '320px',
                borderColor: isValid ? '' : 'red',
              }}
            />
            {!isValid && (
              <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                Invalid CIDR format
              </div>
            )}
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

        {error && (
          <div style={{ color: 'red', marginTop: '8px' }}>{error}</div>
        )}
      </div>
    </div>
  );
}

export default Nmap;