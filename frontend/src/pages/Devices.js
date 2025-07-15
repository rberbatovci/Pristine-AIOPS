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
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
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
            setIsDropdownVisible(false);
            setActiveDropdown(null);
        } else {
            setIsDropdownVisible(true);
            setActiveDropdown(type);
        }
    };

    const handleNewDevice = {

    };

    return (
        <div className="signals-container" style={{ width: selectedDevice ? '80%' : '50%' }}>
            <div className="left-column" style={{ width: selectedDevice ? '40%' : '100%', height: '100vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>

                        {!selectedDevice && (
                            <>
                                <button className="iconButton" disabled="true">
                                    <MdOutlineDeleteForever className="defaultIcon" />
                                    <MdDeleteForever className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'addNew' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('addNew')}
                                >
                                    <RiAddCircleLine className="defaultIcon" />
                                    <RiAddCircleFill className="hoverIcon" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                {isDropdownVisible && (
                    <div className={`dropdownMenu ${isDropdownVisible ? 'dropdownVisible' : 'dropdownHidden'}`} style={{ width: '370px' }}>
                        {activeDropdown === 'addNew' && <AddNew onDeviceAdded={handleNewDevice} />}
                    </div>
                )}
                <div style={{ marginTop: '10px', marginLeft: '10px', marginRight: '10px', marginBottom: '5px', background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', height: 'calc(100vh - 185px)', overflowY: 'auto' }}>
                    <List
                        devices={devices}
                        onDeviceSelect={handleDeviceSelect}
                    />
                </div>
            </div>

            {/* Right Column */}
            {selectedDevice && (
                <div className="right-column">
                    <div className="right-content-wrapper" style={{ transition: '0.5s' }}>
                        <div className="right-content">
                            {showComponents && (
                                <>
                                    <Info
                                        currentUser={currentUser}
                                        selectedDevice={selectedDevice}
                                        onDeviceDeselect={handleDeviceDeselect}
                                        onConfigClick={handleConfigClick}
                                    />

                                    {/* Dynamically render telemetry stats based on what's enabled */}
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
                        {activeConfig && (
                            <div
                                className="dropdownMenu dropdownVisible"
                                style={{
                                    width:
                                        activeConfig === 'syslogs' ? '340px' :
                                            activeConfig === 'netflow' ? '400px' :
                                                activeConfig === 'telemetry' ? '250px' :
                                                    '420px', // fallback
                                    marginTop: '30px',
                                    right: '30px',
                                    position: 'absolute',
                                }}
                            >
                                {activeConfig === 'syslogs' && (
                                    <SyslogConfig hostname={selectedDevice.hostname} version={selectedDevice.version} />
                                )}
                                {activeConfig === 'snmpTraps' && (
                                    <SnmpTrapConfig hostname={selectedDevice.hostname} version={selectedDevice.version} />
                                )}
                                {activeConfig === 'netflow' && (
                                    <NetflowConfig hostname={selectedDevice.hostname} version={selectedDevice.version} />
                                )}
                                {activeConfig === 'telemetry' && (
                                    <TelemetryConfig hostname={selectedDevice.hostname} version={selectedDevice.version} telemetryFeatures={selectedDevice.features?.telemetry || {}} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Devices;
