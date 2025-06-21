import React, { useState } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';

const vendorOptions = [
    { value: 'cisco', label: 'Cisco' },
    { value: 'juniper', label: 'Juniper' },
];

const versionOptions = [
    { value: 'ios-xe', label: 'IOS XE' },
    { value: 'ios-xr', label: 'IOS XR' },
];

function DeviceInfo({ onSubmit, onClose }) {
    const [ipAddress, setIpAddress] = useState('');
    const [hostname, setHostname] = useState('');
    const [vendor, setVendor] = useState(null);
    const [version, setVersion] = useState(null);
    const [localError, setLocalError] = useState('');

    const handleSubmit = () => {
        if (!ipAddress || !hostname || !vendor) {
            setLocalError('IP address, hostname, and vendor are required.');
            return;
        }

        setLocalError('');
        onSubmit({ ip_address: ipAddress, hostname, vendor, version });
    };

    const handleClear = () => {
        onClose();
    }

    return (
        <div className="searchSyslogsContainer">
            <span className="searchSignalFilterText">Add a new device</span>
            <div className="searchSyslogsFilterEntries" style={{marginTop: '5px'}}>
                {/* Agent Hostnames Field */}
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Agent IP address:</span>
                    <div style={{ marginTop: '6px', width: '300px' }}>
                        <input placeholder="IP Address" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="inputText" style={{width: '320px'}}/>
                    </div>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Agent hostname:</span>
                    <div style={{ marginTop: '6px' }}>
                        <input placeholder="IP Address" value={hostname} onChange={(e) => setHostname(e.target.value)} className="inputText" style={{width: '320px'}} />
                    </div>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Agent vendor:</span>
                    <div style={{ marginTop: '6px' }}>
                        <Select placeholder="Vendor" options={vendorOptions} value={vendor} onChange={setVendor} styles={customStyles('325px')} />
                    </div>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Agent version:</span>
                    <div style={{ marginTop: '6px' }}>
                        <Select placeholder="Version" options={versionOptions} value={version} onChange={setVersion} styles={customStyles('325px')} />
                    </div>
                </div>
            </div>
            <div className="searchButtonContainer">
                <button onClick={handleClear} className="searchButton">
                    Clear and Hide
                </button>
                <button onClick={handleSubmit} className="searchButton">
                    Add and configure
                </button>
            </div>
        </div>
    );
}

export default DeviceInfo;
