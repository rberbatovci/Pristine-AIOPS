import React, { useState, useEffect } from 'react';
import '../css/Devices.css';
import AddNew from '../components/devices/AddNew';
import List from '../components/devices/List';
import SyslogConfig from '../components/devices/SyslogConfig';
import SnmpTrapConfig from '../components/devices/SnmpTrapConfig';
import NetflowConfig from '../components/devices/NetflowConfig';
import TelemetryConfig from '../components/devices/TelemetryConfig';
import Info from '../components/devices/Info';
import CPUUtilsStats from '../components/devices/CPUUtilsStats';
import MemoryStats from '../components/devices/MemoryStats';
import InterfaceStats from '../components/devices/InterfaceStats';
import BGPStats from '../components/devices/BGPStats';
import ISISStats from '../components/devices/ISISStats';
import Dashboard from '../components/devices/Dashboard';
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import { IoMdRefresh, IoMdRefreshCircle } from "react-icons/io";
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import apiClient from '../components/misc/AxiosConfig';
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";

function Devices({ currentUser, setDashboardTitle }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState([]);
    const [showComponents, setShowComponents] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);

    const [hostname, setHostname] = useState('');
    const [version, setVersion] = useState('');
    const [activeConfig, setActiveConfig] = useState(null);

    useEffect(() => {
        setDashboardTitle("Devices Dashboard");
        return () => setDashboardTitle(''); // Clean up when navigating away
    }, [setDashboardTitle]);

    const handleConfigClick = (type) => {
        setActiveConfig(prev => prev === type ? null : type);
    };

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await apiClient.get('/devices/');
                const devices = response.data.map((device) => ({
                    id: device.id,
                    hostname: device.hostname,
                    ip_address: device.ip_address,
                    version: device.version,
                    vendor: device.vendor,
                    label: device.hostname,
                }));
                setDevices(devices);
            } catch (error) {
                console.error('Error fetching agent data:', error);
            }
        };

        fetchDevices()
    }, []);

    const handleDeviceAdded = (newDevice) => {
        setDevices((prevDevices) => [...prevDevices, newDevice]);
    };

    const handleDeviceSelect = async (device) => {
        console.log('Selected device:', device);
        setSelectedDevice(device);
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/`);
            setSelectedDevice(response.data);
            setShowComponents(true);
        } catch (error) {
            console.error('Error fetching device details:', error);
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
        setShowComponents(false);
    }

    const toggleDropdown = (type) => {
        if (activeDropdown === type) {
            setActiveDropdown(null);
        } else {
            setActiveDropdown(type);
        }
    };

    const handleNewDevice = {

    };

    useEffect(() => {
        if (selectedDevice) {
            const timeout = setTimeout(() => setShowComponents(true), 1000);
            return () => clearTimeout(timeout);
        } else {
            const timeout = setTimeout(() => setShowComponents(false), 2000);
            return () => clearTimeout(timeout);
        }
    }, [selectedDevice]);

    return (
        <div className="signals-container" style={{ display: 'flex', width: showComponents ? '80%' : '40%', transition: 'width 1s ease' }}>
            <div
                style={{
                    width: showComponents ? '40%' : '100%',
                    transition: 'width 1s ease-in-out, opacity 1s ease-in-out',
                    overflow: 'hidden',
                    height: '100vh',
                }}
            >

                {/* Buttons and dropdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                        <button
                            className={`iconButton ${activeDropdown === 'addNew' ? 'active' : ''}`}
                            onClick={() => toggleDropdown('addNew')}
                        >
                            <RiAddCircleLine className="defaultIcon" />
                            <RiAddCircleFill className="hoverIcon" />
                        </button>
                    </div>
                </div>
                { activeDropdown === 'addNew' && (
                    <div className="dropdownMenu dropdownVisible" style={{ width: '370px' }}>
                        <AddNew onDeviceAdded={handleNewDevice} />
                    </div>
                )}

                <div style={{
                    margin: '10px',
                    background: 'var(--backgroundColor3)',
                    padding: '10px',
                    borderRadius: '10px',
                    height: 'calc(100vh - 185px)',
                    overflowY: 'auto',
                }}>
                    <List devices={devices} onDeviceSelect={handleDeviceSelect} />
                </div>
            </div>
            <div
                className="right-column"
                style={{
                    width: showComponents ? '60%' : '0',
                    transition: 'width 1s ease-in-out',
                    overflow: 'auto',
                }}
            >
                <div className="right-content-wrapper">
                    <div className="right-content" style={{
                        transition: 'transition 1s ease-in-out'
                    }}>
                        {showComponents && (
                            <>
                                <Info
                                    currentUser={currentUser}
                                    selectedDevice={selectedDevice}
                                    onDeviceDeselect={handleDeviceDeselect}
                                    onConfigClick={handleConfigClick}
                                />
                                {selectedDevice.features?.telemetry?.cpu_util && (
                                    <CPUUtilsStats currentUser={currentUser} selectedDevice={selectedDevice.hostname} />
                                )}
                                {selectedDevice.features?.telemetry?.memory_stats && (
                                    <MemoryStats currentUser={currentUser} selectedDevice={selectedDevice} />
                                )}
                                {selectedDevice.features?.telemetry?.interface_stats && (
                                    <InterfaceStats currentUser={currentUser} selectedDevice={selectedDevice} />
                                )}
                                {selectedDevice.features?.telemetry?.bgp_connections && (
                                    <BGPStats currentUser={currentUser} selectedDevice={selectedDevice} />
                                )}
                                {selectedDevice.features?.telemetry?.isis_stats && (
                                    <ISISStats currentUser={currentUser} selectedDevice={selectedDevice} />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

        </div >
    );
}

export default Devices;
