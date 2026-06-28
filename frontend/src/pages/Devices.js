import React, { useState, useEffect, useRef } from 'react';
import '../css/Devices.css';  
import List from '../components/devices/List';
import InterfaceStatistics from '../components/devices/InterfaceStatistics';
import SystemUtilization from '../components/devices/SystemUtilization';
import Info from '../components/devices/Info';
import { RiSearchEyeLine, RiSearchEyeFill } from "react-icons/ri";
import kcFetch from '../components/misc/kcFetch';
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";

function Devices({ currentUser, setDashboardTitle, showNotification, keycloak, selectedDevice, setSelectedDevice, devicesRefreshKey }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState([]);
    const [showComponents, setShowComponents] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRef = useRef(null);
    const [hostname, setHostname] = useState('');
    const [version, setVersion] = useState('');
    const [activeConfig, setActiveConfig] = useState(null);

    useEffect(() => {
        setDashboardTitle("Devices Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    const handleConfigClick = (type) => {
        setActiveConfig(prev => prev === type ? null : type);
    };

    const fetchDevices = async () => {
        try {
            const response = await kcFetch(keycloak, `/devices/`);
            const devices = response.map(device => ({
                id: device.id,
                hostname: device.hostname,
                ip_address: device.ip_address,
                label: device.hostname,
            }));
            setDevices(devices);
        } catch (error) {
            console.error('Error fetching agent data:', error);
        }
    };

    useEffect(() => {
        fetchDevices()
    }, [devicesRefreshKey]);

    const handleDeviceAdded = (newDevice) => {
        setDevices(prev => [...prev, newDevice]); // instant UI update
        fetchDevices(); // then sync with backend
    };

    const handleDeviceSelect = async (device) => {
        console.log('Selected device:', device);
        try {
            const data = await kcFetch(keycloak, `/devices/${device.hostname}`);
            setSelectedDevice(data);
            setShowComponents(true);
        } catch (error) {
            console.error('Error fetching device details:', error);
            showNotification("Failed to fetch device details", "error");
        }
    };

    const handleDeviceUpdate = (updatedDevice) => {
        setDevices((prevDevices) =>
            prevDevices.map((device) =>
                device.id === updatedDevice.id ? updatedDevice : device
            )
        );
    };

    const handleDeviceDelete = (deviceId) => {
        setDevices((prevDevices) =>
            prevDevices.filter((device) => device.id !== deviceId)
        );
        setSelectedDevice(null);
    };

    const handleDeviceDeselect = () => {
        setSelectedDevice(null);
    };

    const toggleDropdown = (type) => {
        if (activeDropdown === type) {
            setActiveDropdown(null);
        } else {
            setActiveDropdown(type);
        }
    };

    const handleNewDevice = () => {
        fetchDevices();
        setActiveDropdown(null);
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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setActiveDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="devices-container" style={{ display: 'flex', width: showComponents ? '80%' : '40%', transition: 'width 1s ease' }}>
            <div style={{ width: showComponents ? '40%' : '100%', transition: 'width 1s ease-in-out, opacity 1s ease-in-out', overflow: 'hidden', height: 'calc(100vh - 90px)', padding: '10px' }} >
                <div className="mainContainer" style={{ padding: '10px' }}>
                    <List devices={devices} keycloak={keycloak} onDeviceSelect={handleDeviceSelect} />
                </div>
            </div>
            <div className="right-column" style={{ width: showComponents ? '60%' : '0', transition: 'width 1s ease-in-out', overflow: 'auto' }}>
                <div className="right-content-wrapper">
                    <div className="right-content" style={{ transition: 'width 1s ease-in-out', paddingLeft: '10px', paddingRight: '10px' }}>
                        {showComponents && selectedDevice && (<>
                            <Info selectedDevice={selectedDevice} onDeviceDeselect={handleDeviceDeselect} />
                            <SystemUtilization keycloak={keycloak} selectedDevice={selectedDevice} onSuccess={fetchDevices} showNotification={showNotification} />
                            <InterfaceStatistics keycloak={keycloak} selectedDevice={selectedDevice} onSuccess={fetchDevices} showNotification={showNotification} /> </>
                        )}
                    </div>
                </div>
            </div>

        </div >
    );
}

export default Devices;
