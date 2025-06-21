import React, { useState, useEffect } from 'react';
import '../css/Devices.css';
import AddNew from '../components/devices/AddNew';
import List from '../components/devices/List';
import Info from '../components/devices/Info';
import InterfaceStats from '../components/devices/InterfaceStats';
import Dashboard from '../components/devices/Dashboard';
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import { IoMdRefresh, IoMdRefreshCircle } from "react-icons/io";
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import apiClient from '../components/misc/AxiosConfig';
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";

function Devices({ currentUser }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState([]);
    const [showComponents, setShowComponents] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [dropdowns, setDropdowns] = useState({
        addNewDevice: { visible: false, position: { x: 0, y: 0 } },
    });

    const handleButtonClick = (event, dropdownKey) => {
        // Create a new dropdowns object with all dropdowns set to hidden
        const updatedDropdowns = Object.keys(dropdowns).reduce((acc, key) => {
            acc[key] = { ...dropdowns[key], visible: false };
            return acc;
        }, {});

        // Toggle visibility of the selected dropdown
        setDropdowns({
            ...updatedDropdowns,
            [dropdownKey]: {
                ...dropdowns[dropdownKey],
                visible: !dropdowns[dropdownKey].visible,
            },
        });
    };



    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await apiClient.get('/devices/');
                const devices = response.data.map((device) => ({
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

        fetchDevices()
    }, []);

    const handleDeviceAdded = (newDevice) => {
        setDevices((prevDevices) => [...prevDevices, newDevice]);
    };

    const handleDeviceSelect = async (device) => {
        console.log('Selected device:', device);
        setSelectedDevice(device);  // Temporarily set selected device to update UI

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
        setSelectedDevice(null); // Clear the selected device after deletion
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

    const handleNewDevice  = {

    };

    return (
        <div className="signals-container" style={{ width: selectedDevice ? '80%' : '50%' }}>
            <div className="left-column" style={{ width: selectedDevice ? '40%' : '100%', height: '100vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h2 style={{ marginTop: '-5px', paddingLeft: '20px', fontSize: '23px', color: 'var(--text-color)' }}>Incidents Dashboard</h2>
                    <div style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                        <input
                            type="text"
                            style={{
                                background: 'var(--background1)',
                                border: 'none',
                                outline: 'none',
                                height: '30px',
                                width: '250px',
                                paddingLeft: '15px',
                                color: 'white',
                                fontSize: '15px',
                                borderRadius: '10px',
                                marginRight: '10px',
                            }}
                            placeholder="Search Event..."
                        />
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
                    <div style={{ position: 'absolute', borderRadius: '10px', right: '10px', background: 'var(--dropdownBackground)',  width: '365px' }}>
                        {activeDropdown === 'addNew' && <AddNew onDeviceAdded={handleNewDevice}/>}
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
                                    <Info currentUser={currentUser} selectedDevice={selectedDevice} onDeviceDeselect={handleDeviceDeselect} />
                                    <InterfaceStats currentUser={currentUser} selectedDevice={selectedDevice} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Devices;
