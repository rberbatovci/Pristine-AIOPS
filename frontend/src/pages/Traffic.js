import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import kcFetch from '../components/misc/kcFetch'; 
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri"; 
import SearchTime from '../components/misc/SearchTime.js'; 
import FilterTraffic from '../components/netflow/FilterTraffic.js';
import ChartView from '../components/misc/ChartView.js';

import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";
import { IoPieChartOutline, IoPieChartSharp, IoRefreshCircleOutline, IoRefreshCircleSharp } from "react-icons/io5";

function Traffic({ currentUser, setDashboardTitle, keycloak }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [selectedTags, setSelectedTags] = useState([]);
    const [dataSource, setDataSource] = useState('syslogs');
    const [eventsData, setEventsData] = useState([]);
    const downloadRef = useRef(null);
    const dropdownWrapperRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const buttonsContainerRef = useRef(null);
    const [dropdowns, setDropdowns] = useState({
        search: { visible: false, position: { x: 0, y: 0 } },
        time: { visible: false, position: { x: 0, y: 0 } },
        download: { visible: false, position: { x: 0, y: 0 } },
    });
    const [devices, setDevices] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(21);
    const [totalEvents, setTotalEvents] = useState(0);
    const baseColumns = [
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'Device', value: 'device' },
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Destination IP', value: 'dest_ip' },
        { label: 'Destination Port', value: 'dest_port' },
        { label: 'Protocol', value: 'protocol' },
        { label: 'Input Interface', value: 'input_if' },
        { label: 'Output Interface', value: 'output_if' },
        { label: 'Bytes', value: 'bytes' },
        { label: 'Packets', value: 'packets' },
    ];

    const [selectedDevice, setSelectedDevice] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState(baseColumns);
    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [filters, setFilters] = useState({});
    const [view, setView] = useState("list");
    const totalPages = Math.ceil(totalEvents / pageSize);

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

    const loadNetflowData = async (
        keycloak,
        page = 1,
        pageSize = 20,
        startTime = startTime,
        endTime = endTime,
        filters = {}
    ) => {
        setEventsData(null);
        setLoading(true);
        setError(null);

        try {
            // Base URL for netflow
            let url = `/netflow/?page=${page}&page_size=${pageSize}`;

            if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
            if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;

            // Add filters
            const query = new URLSearchParams();

            if (filters.device?.length) {
                filters.device.forEach(device => query.append("device", device));
            }

            if (query.toString()) {
                url += `&${query.toString()}`;
            }

            const data = await kcFetch(keycloak, url);

            let results = [];

            if (data?.results) {
                results = data.results.map(item => item._source || item);
                setTotalEvents(data.total || 0);
            } else if (Array.isArray(data)) {
                results = data.map(item => item._source || item);
                setTotalEvents(data.length);
            } else {
                console.warn("Unexpected response data structure:", data);
            }

            setEventsData(results);
        } catch (error) {
            console.error("Error fetching netflow data:", error);
            setError("Error fetching netflow data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNetflowData(keycloak, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    }, [page, pageSize, startTime, endTime, pageSize]);

    useEffect(() => {
        const fetchDevices = async () => {
            try {
                const response = await kcFetch(keycloak, "/devices/");
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



    const handleRowSelectChange = (newSelectedRows) => {
        console.log('Testing!!!');
    };

    const handleNextPage = () => {
        if (page * pageSize < totalEvents) {
            setPage(prevPage => prevPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (page > 1) {
            setPage(prevPage => prevPage - 1);
        }
    };

    const handleTimeRangeChange = (start, end) => {
        setStartTime(start);
        setEndTime(end);
    };

    const handleTimeRangeSelect = (range) => {
        loadNetflowData(keycloak, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    };

    const handleSearchAndCloseDropdown = (filters) => {
        console.log('Selected tags:', filters);

        setDropdowns(prev => ({
            ...prev,
            searchSyslogs: { ...prev.searchSyslogs, visible: false }
        }));

        loadNetflowData(keycloak, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    };

    const handleApplyEventsPerPage = () => {
        loadNetflowData(keycloak, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters); // Reset to page 1 when page size changes
    };

    const handlePageSizeChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setPageSize(isNaN(value) || value < 1 ? 1 : value);
    };

    const handleSyslogTagsChange = (selectedTags) => {
        console.log('Selected tags:', selectedTags)
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
                        Netflow
                    </h2>
                </div>
                <div className="mainContainerButtons">
                    {view === "list" ? (
                        <button
                            className="iconButton"
                            onClick={() => setView("chart")}
                            style={{ marginRight: '20px' }}
                        >
                            <TfiLayoutListThumb className="defaultIcon" />
                            <IoPieChartSharp className="hoverIcon" />
                        </button>
                    ) : (
                        <button
                            className="iconButton"
                            onClick={() => setView("list")}
                            style={{ marginRight: '20px' }}
                        >
                            <IoPieChartOutline className="defaultIcon" />
                            <TfiLayoutListThumbAlt className="hoverIcon" />
                        </button>
                    )}
                    <button className="iconButton">
                        <IoRefreshCircleOutline className="defaultIcon" />
                        <IoRefreshCircleSharp className="hoverIcon" />
                    </button>
                    <button
                        className={`iconButton ${dropdowns.search.visible ? 'active' : ''} `}
                        onClick={(event) => handleButtonClick(event, 'search')}
                    >
                        <RiFilterLine className="defaultIcon" />
                        <RiFilterFill className="hoverIcon" />
                    </button>
                    <button
                        className="iconButton"
                        onClick={(event) => handleButtonClick(event, 'time')}
                    >
                        <FaRegClock className="defaultIcon hasFilters" />
                        <FaClock className="hoverIcon" />
                    </button>
                    <button
                        className="iconButton"
                    >
                        <RiDownloadCloudLine className="defaultIcon" />
                        <RiDownloadCloudFill className="hoverIcon" />
                    </button>

                </div>
            </div>

            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (view === "list" ? (
                    <div className="syslogsTableContainer">
                        <EventsTable currentUser={currentUser} data={eventsData} columns={baseColumns} signalSource={dataSource} onDownload={(downloadFn) => (downloadRef.current = downloadFn)} onRowSelectChange={handleRowSelectChange} />
                    </div>) : (
                    <div className="syslogsTableContainer">
                        <ChartView keycloak={keycloak} currentUser={currentUser} source='events' dataSource='netflow' selectedTags={baseColumns} />
                    </div>))}
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
                    className={`dropdownMenu ${dropdowns.search.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }}
                >
                    <FilterTraffic
                        columns={baseColumns}
                        devices={devices}
                        onSelectedTagsChange={handleSyslogTagsChange}
                        onSelectedTagsSearch={handleSearchAndCloseDropdown}
                    />
                </div>
            </div>
        </div>
    );
}

export default Traffic;
