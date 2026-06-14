import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import SearchTime from '../components/misc/SearchTime.js';
import TelemetryStats from '../components/telemetry/TelemetryStats.js';
import CPUUtilsStats from '../components/telemetry/CPUUtilsStats.js';
import InterfaceStats from '../components/telemetry/InterfaceStats.js';
import InterfaceOper from '../components/telemetry/InterfaceOper.js';
import MemoryStats from '../components/telemetry/MemoryStats.js';
import kcFetch from '../components/misc/kcFetch';

function Performance({ currentUser, setDashboardTitle, keycloak, showNotification, selectedDevice }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const dropdownWrapperRef = useRef(null);
    const dropdownMenuRef = useRef(null); 
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
                const response = await kcFetch(
                                keycloak,
                                "/devices/"
                            );
                const devices = response.map((device) => ({
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
            setDashboardTitle("Performance Dashboard");
            return () => setDashboardTitle('');
        }, [setDashboardTitle]);

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
        <div >  
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <div style={{ height: 'calc(100vh - 60px)', overflowY: 'auto', width: '1200px' }} >
                        <CPUUtilsStats selectedDevice={selectedDevice} keycloak={keycloak} />
                        <MemoryStats selectedDevice={selectedDevice} keycloak={keycloak} />
                        <InterfaceOper selectedDevice={selectedDevice} keycloak={keycloak} />
                        <InterfaceStats selectedDevice={selectedDevice} keycloak={keycloak} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default Performance;
