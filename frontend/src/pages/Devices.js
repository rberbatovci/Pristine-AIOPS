import React, { useState, useEffect, useRef } from 'react';
import '../css/Devices.css';  
import List from '../components/devices/List';
import InterfaceStatistics from '../components/devices/InterfaceStatistics';
import SystemUtilization from '../components/devices/SystemUtilization';
import Info from '../components/devices/Info';
import kcFetch from '../components/misc/kcFetch';

// ✅ Make sure you import your custom hooks at the top!
import useDevices from '../hooks/useDevices'; 
import useNetworkScan from '../hooks/useNetworkScan';

function Devices({ currentUser, setDashboardTitle, showNotification, keycloak, selectedDevice, setSelectedDevice, devicesRefreshKey }) {
    const [showComponents, setShowComponents] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRef = useRef(null);

    // 1. ✅ Instantiate the Custom Inventory Hook
    const { devices: onboardedDevices, loading: hookLoading, error: inventoryError } = useDevices(keycloak);
    
    // 2. ✅ Instantiate the Network Scan Hook
    const { 
        scanNetwork, 
        devices: discoveredDevices, 
        loading: sweepLoading, 
        error: sweepError,
        setDevices: setDiscoveredDevices,
        setError: setSweepError
    } = useNetworkScan(keycloak);

    useEffect(() => {
        setDashboardTitle("Devices Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    const handleDeviceSelect = async (device) => {
        console.log('Selected device:', device);
        try {
            // Note: If you are selecting a temporary discovered device, make sure your backend path supports it or falls back cleanly
            const data = await kcFetch(keycloak, `/devices/${device.hostname || device.ip}`);
            setSelectedDevice(data);
            setShowComponents(true);
        } catch (error) {
            console.error('Error fetching device details:', error);
            showNotification("Failed to fetch device details", "error");
        }
    };

    const handleDeviceDeselect = () => {
        setSelectedDevice(null);
    };

    useEffect(() => {
        let timeout;
        if (selectedDevice) {
            timeout = setTimeout(() => setShowComponents(true), 1000);
        } else {
            timeout = setTimeout(() => setShowComponents(false), 200);
        }
        return () => clearTimeout(timeout);
    }, [selectedDevice]);

    return (
        <div className="devices-container" style={{ display: 'flex', width: showComponents ? '80%' : '40%', transition: 'width 1s ease' }}>
            <div style={{ width: showComponents ? '40%' : '100%', transition: 'width 1s ease-in-out, opacity 1s ease-in-out', overflow: 'hidden', height: 'calc(100vh - 90px)', padding: '10px' }} >
                <div className="mainContainer" style={{ padding: '10px' }}>
                    
                    {/* 3. ✅ Pass both arrays as descriptive properties directly down to the List child */}
                    <List 
                        onboardedDevices={onboardedDevices || []} 
                        discoveredDevices={discoveredDevices || []}
                        loading={hookLoading || sweepLoading}
                        keycloak={keycloak} 
                        onDeviceSelect={handleDeviceSelect} 
                    />
                    
                </div>
            </div>
            
            <div className="right-column" style={{ width: showComponents ? '60%' : '0', transition: 'width 1s ease-in-out', overflow: 'auto' }}>
                <div className="right-content-wrapper">
                    <div className="right-content" style={{ transition: 'width 1s ease-in-out', paddingLeft: '10px', paddingRight: '10px' }}>
                        {showComponents && selectedDevice && (
                            <>
                                <Info selectedDevice={selectedDevice} onDeviceDeselect={handleDeviceDeselect} />
                                <SystemUtilization keycloak={keycloak} selectedDevice={selectedDevice} showNotification={showNotification} />
                                <InterfaceStatistics keycloak={keycloak} selectedDevice={selectedDevice} showNotification={showNotification} /> 
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Devices;