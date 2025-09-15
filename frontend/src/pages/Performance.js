import React, { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import apiClient from '../components/misc/AxiosConfig.js';
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import SearchTime from '../components/misc/SearchTime.js';
import TelemetryStats from '../components/telemetry/TelemetryStats.js';
import CPUUtilsStats from '../components/telemetry/CPUUtilsStats.js';
import InterfaceStats from '../components/telemetry/InterfaceStats.js';
import InterfaceOper from '../components/telemetry/InterfaceOper.js';
import MemoryStats from '../components/telemetry/MemoryStats.js';
import BGPStats from '../components/telemetry/BGPStats.js';

function Performance({ currentUser, setDashboardTitle }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const dropdownWrapperRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [devices, setDevices] = useState([]);
    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [dropdowns, setDropdowns] = useState({
        devices: { visible: false, position: { x: 0, y: 0 } },
        time: { visible: false, position: { x: 0, y: 0 } },
        download: { visible: false, position: { x: 0, y: 0 } },
    });

    const handleButtonClick = (event, dropdownKey) => {
        const updatedDropdowns = Object.keys(dropdowns).reduce((acc, key) => {
            acc[key] = { ...dropdowns[key], visible: false };
            return acc;
        }, {});
        const newVisibility = !dropdowns[dropdownKey].visible;
        setDropdowns({
            ...updatedDropdowns,
            [dropdownKey]: {
                ...dropdowns[dropdownKey],
                visible: newVisibility,
            },
        });
    };

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await apiClient.get('/devices');
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

        fetchDevices();
    }, []);

    const handleTimeRangeChange = (start, end) => {
        setStartTime(start);
        setEndTime(end);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownMenuRef.current && !dropdownMenuRef.current.contains(event.target)) {
                // Click is outside the dropdown area, so close all dropdowns
                setDropdowns((prev) => {
                    const newDropdowns = Object.fromEntries(
                        Object.entries(prev).map(([key, value]) => [
                            key,
                            { ...value, visible: false }
                        ])
                    );
                    return newDropdowns;
                });
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="mainContainer" ref={dropdownWrapperRef}>
            <div className="mainContainerHeader">
                <div className="headerTitles">
                    <h2
                        className={"eventsTitleHeader eventsTitleHeaderActive"}
                    >
                        Telemetry
                    </h2>
                </div>
                <div className="mainContainerButtons">
                    <button
                        className={`iconButton ${dropdowns.devices.visible ? 'active' : ''} `}
                        onClick={(event) => handleButtonClick(event, 'devices')}
                    >
                        <RiFilterLine className="defaultIcon" />
                        <RiFilterFill
                            className="hoverIcon"
                        />
                    </button>
                    <button
                        className={`iconButton ${dropdowns.time.visible ? 'active' : ''} `}
                        onClick={(event) => handleButtonClick(event, 'time')}
                    >
                        <FaRegClock className="defaultIcon hasFilters" />
                        <FaClock className="hoverIcon" />
                    </button>
                    <button
                        className={`iconButton ${dropdowns.download.visible ? 'active' : ''} `}
                    >
                        <RiDownloadCloudLine className="defaultIcon" />
                        <RiDownloadCloudFill className="hoverIcon" />
                    </button>
                </div>
            </div>

            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <div style={{ height: 'calc(100vh - 140px)', overflowY: 'auto', width: '100%' }}
                    >
                        <CPUUtilsStats selectedDevice={selectedDevice} />
                        <MemoryStats selectedDevice={selectedDevice} />
                        <InterfaceOper selectedDevice={selectedDevice} />
                        <InterfaceStats selectedDevice={selectedDevice} />
                        <BGPStats selectedDevice={selectedDevice} />
                    </div>
                )}
            </div>
            <div ref={dropdownMenuRef}>
                <div
                    className={`dropdownMenu ${dropdowns.time.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto' }}
                >
                    <SearchTime
                        startTime={startTime}
                        endTime={endTime}
                        onTimeRangeChange={handleTimeRangeChange}
                    />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.devices.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{
                        width: '420px',
                        height: '110px'
                    }}>
                    <TelemetryStats
                        currentUser={currentUser}
                        devices={devices}
                        onDeviceSelect={setSelectedDevice}
                    />
                </div>

            </div>
        </div>
    );
}

export default Performance;
