import React, { useState } from 'react';
import { TailSpin } from 'react-loader-spinner';
import useNetworkScan from '../../hooks/useNetworkScan';
import useDeviceDeepScan from '../../hooks/useDeviceDeepScan';

const isValidCIDR = (value) => {
  const cidrRegex =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/([0-9]|[1-2][0-9]|3[0-2])$/;
  return cidrRegex.test(value);
};

function Nmap({ onDeviceAdded, keycloak }) {
  const [ipAddress, setIpAddress] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [scanStage, setScanStage] = useState('idle'); // 'idle' | 'sweeping' | 'sweep_done' | 'deep_scanning' | 'deep_done'

  // ✅ Instantiate our clean business logic hooks
  const { 
    scanNetwork, 
    devices: discoveredDevices, 
    loading: sweepLoading, 
    error: sweepError,
    setDevices: setDiscoveredDevices,
    setError: setSweepError
  } = useNetworkScan(keycloak);

  const { 
    deepScanDevice, 
    scanResult: deepScanResult, 
    loading: deepLoading, 
    error: deepError,
    setScanResult: setDeepScanResult,
    setError: setDeepError
  } = useDeviceDeepScan(keycloak);

  const handleClear = () => {
    setIpAddress('');
    setIsValid(true);
    setSelectedDevice(null);
    setScanStage('idle');
    setDiscoveredDevices([]);
    setDeepScanResult(null);
    setSweepError('');
    setDeepError('');
  };

  const handleIpChange = (value) => {
    setIpAddress(value);
    if (value === '') {
      setIsValid(true);
    } else {
      setIsValid(isValidCIDR(value));
    }
  };

  // 🚀 Trigger 1: Network Sweep
  const handleNetworkSweep = async () => {
    if (!ipAddress || !isValidCIDR(ipAddress)) {
      setIsValid(false);
      return;
    }
    setScanStage('sweeping');
    try {
      await scanNetwork(ipAddress);
      setScanStage('sweep_done');
    } catch {
      setScanStage('idle');
    }
  };

  // 🚀 Trigger 2: Advanced Deep Scan
  const handleDeepScan = async (deviceIp) => {
    setSelectedDevice(deviceIp);
    setScanStage('deep_scanning');
    try {
      const result = await deepScanDevice(deviceIp);
      setScanStage('deep_done');
      if (onDeviceAdded) onDeviceAdded(result);
    } catch {
      setScanStage('sweep_done');
    }
  };

  return (
    <div className="searchSyslogsContainer" style={{ maxWidth: '500px', gap: '16px', display: 'flex', flexDirection: 'column' }}>
      <span className="searchSignalFilterText" style={{ fontWeight: 'bold', fontSize: '18px' }}>
        Network Automation Engine
      </span>
      
      {/* Network Inputs */}
      <div>
        <span className="searchSignalFilterText">Target Network (CIDR Range):</span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
          <input
            placeholder="e.g. 10.10.1.0/24"
            value={ipAddress}
            disabled={sweepLoading || deepLoading}
            onChange={(e) => handleIpChange(e.target.value)}
            className="inputText"
            style={{ flex: 1, borderColor: isValid ? '' : 'red' }}
          />
          <button 
            onClick={handleClear} 
            className="addRuleButton" 
            style={{ backgroundColor: '#6c757d', width: 'auto', padding: '0 12px' }}
          >
            Reset
          </button>
        </div>
        {!isValid && (
          <div style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
            Invalid CIDR format
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      {scanStage === 'idle' && (
        <button onClick={handleNetworkSweep} className="addRuleButton" style={{ width: '100%' }}>
          Scan Network Range
        </button>
      )}

      {/* Loading States */}
      {(sweepLoading || deepLoading) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f0f4f8', borderRadius: '4px' }}>
          <TailSpin height={20} width={20} color="#007bff" />
          <span style={{ fontSize: '14px', color: '#555' }}>
            {sweepLoading ? 'Sweeping network for live hosts...' : `Running advanced Nmap options against ${selectedDevice}...`}
          </span>
        </div>
      )}

      {/* Discovered Live Devices List */}
      {(scanStage === 'sweep_done' || scanStage === 'deep_scanning' || scanStage === 'deep_done') && (
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px' }}>
          <span style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            Discovered Live Hosts ({discoveredDevices.length}):
          </span>
          {discoveredDevices.length === 0 ? (
            <div style={{ fontSize: '14px', color: '#666' }}>No responsive devices found.</div>
          ) : (
            <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {discoveredDevices.map((device) => (
                <div 
                  key={device.ip} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '6px 8px', 
                    background: selectedDevice === device.ip ? '#e3f2fd' : '#f8f9fa',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <span><strong>{device.ip}</strong> {device.hostname ? `(${device.hostname})` : ''}</span>
                  <button 
                    disabled={sweepLoading || deepLoading}
                    onClick={() => handleDeepScan(device.ip)}
                    style={{
                      padding: '4px 8px',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Deep Scan
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Render Deep Scan Output JSON */}
      {scanStage === 'deep_done' && deepScanResult && (
        <div style={{ border: '1px solid green', borderRadius: '4px', padding: '12px', background: '#f4fbf4' }}>
          <span style={{ fontWeight: 'bold', color: 'green', display: 'block', marginBottom: '6px' }}>
            Advanced Scan Complete for {selectedDevice}
          </span>
          {deepScanResult.os_match?.length > 0 && (
            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
              <strong>Detected OS:</strong> {deepScanResult.os_match[0].name} ({deepScanResult.os_match[0].accuracy}%)
            </div>
          )}
          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>Open Ports & Fingerprinted Services:</span>
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '4px', fontSize: '12px', background: '#fff', border: '1px solid #eee', padding: '6px' }}>
            {Object.keys(deepScanResult.protocols || {}).length === 0 ? (
              <div>No open ports discovered.</div>
            ) : (
              Object.keys(deepScanResult.protocols).map((proto) => 
                deepScanResult.protocols[proto].map((portObj) => (
                  <div key={portObj.port} style={{ padding: '3px 0', borderBottom: '1px dashed #eee' }}>
                    <span style={{ color: '#007bff', fontWeight: 'bold' }}>{portObj.port}/{proto}</span> - 
                    <span style={{ color: '#28a745' }}> {portObj.state}</span> | 
                    <strong> {portObj.name}</strong> {portObj.product ? `(${portObj.product} v${portObj.version})` : ''}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Global Error Rendering */}
      {(sweepError || deepError) && (
        <div style={{ color: 'red', marginTop: '4px', fontSize: '14px' }}>
          {sweepError || deepError}
        </div>
      )}
    </div>
  );
}

export default Nmap;