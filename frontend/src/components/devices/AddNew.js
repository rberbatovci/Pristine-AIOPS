import { useState } from 'react';
import { TailSpin } from 'react-loader-spinner';
import kcFetch from '../misc/kcFetch';

function AddNewDevice({ onDeviceAdded, keycloak, showNotification }) {
  const [ipAddress, setIpAddress] = useState('');
  const [hostname, setHostname] = useState('');
  const [vendor, setVendor] = useState('');
  const [version, setVersion] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClear = () => {
    setIpAddress('');
    setHostname('');
    setVendor('');
    setVersion('');
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess(false);

    // Required fields
    if (!ipAddress || !hostname || !vendor || !version) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        ip_address: ipAddress.trim(),
        hostname: hostname.trim(),
        vendor: vendor.trim(),
        version: version.trim(),
      };

      console.log('Adding device:', payload);

      const res = await kcFetch(keycloak, '/devices/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setSuccess(true);

      showNotification(
        'Device added successfully',
        'success'
      );

      if (onDeviceAdded) {
        onDeviceAdded();
      }

      handleClear();

    } catch (err) {
      console.error('Failed to add device:', err);

      setError(
        'Failed to add device. Make sure the hostname is unique.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="searchSyslogsContainer">

      <span className="searchSignalFilterText">
        Add a new device
      </span>

      <div>

        {/* IP Address */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">
            Agent IP address:
          </span>

          <div style={{ marginTop: '6px', width: '300px' }}>
            <input
              type="text"
              placeholder="IP Address"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="inputText"
              style={{ width: '320px' }}
            />
          </div>
        </div>

        {/* Hostname */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">
            Agent hostname:
          </span>

          <div style={{ marginTop: '6px' }}>
            <input
              type="text"
              placeholder="Hostname"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="inputText"
              style={{ width: '320px' }}
            />
          </div>
        </div>

        {/* Vendor */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">
            Agent vendor:
          </span>

          <div style={{ marginTop: '6px' }}>
            <input
              type="text"
              placeholder="Vendor (e.g. Cisco)"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="inputText"
              style={{ width: '320px' }}
            />
          </div>
        </div>

        {/* Version */}
        <div className="searchSyslogsFilterEntry">
          <span className="searchSignalFilterText">
            Agent version:
          </span>

          <div style={{ marginTop: '6px' }}>
            <input
              type="text"
              placeholder="Version (e.g. IOS-XE 17.9.4)"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="inputText"
              style={{ width: '320px' }}
            />
          </div>
        </div>

      </div>

      {/* Save button */}
      <div className="searchButtonContainer">
        <button
          onClick={handleSubmit}
          disabled={loading}
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
            <TailSpin
              height={16}
              width={16}
              color="#fff"
            />
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
