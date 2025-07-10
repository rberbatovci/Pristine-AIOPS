import React, { useEffect, useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import '../../css/SignalsList.css';
import { PiTerminalDuotone, PiTerminalFill } from "react-icons/pi";
import { RiStackshareLine, RiStackshareFill } from "react-icons/ri";
import { PiSwapFill, PiSwapDuotone } from "react-icons/pi";
import { IoAnalyticsOutline } from "react-icons/io5";
import { IoMdAnalytics } from "react-icons/io";

function List({ devices, onDeviceSelect }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);

    const handleDeviceClick = (device) => {
        setSelectedDevice(device);
        onDeviceSelect(device);
    };


    
    console.log("Devices in List component:", devices);

    return (
        <div className="signals-list-container">
            {loading && <p>Loading devices...</p>}
            {error && <p className="error-message">{error}</p>}
            {devices.length === 0 && !loading && !error ? (
                <p>No devices found</p>
            ) : (
                <ul className="signals-list" style={{ paddingLeft: '0', listStyle: 'none' }}>
                    {devices.map((device) => (
                        <li
                            key={device.id}
                            onClick={() => handleDeviceClick(device)}
                            className={`signalTagItem ${selectedDevice?.id === device.id ? 'selected' : ''}`}
                            style={{ height: '60px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'column', marginLeft: '20px' }}>
                                <div><span >Hostname: {device.hostname}</span></div>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                <div><span >IP Address: {device.ip_address}</span></div>
                                <div><span >Vendor: {device.vendor}</span></div>
                                <div><span >Version: {device.version}</span></div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', marginLeft: 'auto' }}>
                                <button
                                    className={`iconButton ${device.features?.syslogs ? 'active' : ''}`}>
                                    <PiTerminalDuotone className="defaultIcon" />
                                    <PiTerminalFill className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${device.features?.snmp_traps ? 'active' : ''}`}>
                                    <RiStackshareLine className="defaultIcon" />
                                    <RiStackshareFill className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${device.features?.netflow ? 'active' : ''}`}>
                                    <PiSwapFill className="defaultIcon" />
                                    <PiSwapDuotone className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${device.features?.telemetry?.cpu_util ||
                                            device.features?.telemetry?.memory_stats ||
                                            device.features?.telemetry?.interface_stats
                                            ? 'active'
                                            : ''
                                        }`}>
                                    <IoAnalyticsOutline className="defaultIcon" />
                                    <IoMdAnalytics className="hoverIcon" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>

    );
}

export default List;
