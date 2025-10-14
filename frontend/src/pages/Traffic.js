import React, { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import apiClient from '../components/misc/AxiosConfig.js';
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import SearchTime from '../components/misc/SearchTime.js';
import Pagination from '@mui/material/Pagination';
import FilterTraffic from '../components/netflow/FilterTraffic.js';
import NetflowChart from '../components/netflow/Chart.js';

import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { IoPieChartOutline, IoPieChartSharp } from "react-icons/io5";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";

function Traffic({ currentUser, setDashboardTitle }) {
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
    const [pageSize, setPageSize] = useState(24);
    const [totalEvents, setTotalEvents] = useState(0);
    const baseColumns = [
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'Exporter IP', value: 'exporter_ip' },
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Destination IP', value: 'dest_ip' },
        { label: 'Destination Port', value: 'dest_port' },
        { label: 'Protocol', value: 'protocol' },
        { label: 'Input SNMP', value: 'input_snmp' },
        { label: 'Output SNMP', value: 'output_snmp' },
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

    const loadNetflowData = (page = 1, pageSize = 20, startTime = startTime, endTime = endTime, filters = {}) => {
        setEventsData(null);
        setLoading(true);

        // Base URL for netflow
        let url = `/netflow/?page=${page}&page_size=${pageSize}`;
        if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
        if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;

        // Add filters
        const query = new URLSearchParams();

        if (filters.device?.length) {
            filters.device.forEach(device => query.append('device', device));
        }

        if (query.toString()) {
            url += `&${query.toString()}`;
        }

        apiClient
            .get(url)
            .then(response => {
                let results = [];
                if (response.data && response.data.results) {
                    results = response.data.results.map(item => item._source || item);
                    setTotalEvents(response.data.total || 0);
                } else if (Array.isArray(response.data)) {
                    results = response.data.map(item => item._source || item);
                    setTotalEvents(response.data.length);
                } else {
                    console.warn('Unexpected response data structure:', response.data);
                }
                setEventsData(results);
            })
            .catch(error => {
                console.error('Error fetching netflow data:', error);
                setError('Error fetching netflow data');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        loadNetflowData(page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    }, [page, pageSize, startTime, endTime, pageSize]);

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
        loadNetflowData(page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    };

    const handleSearchAndCloseDropdown = (filters) => {
        console.log('Selected tags:', filters);

        setDropdowns(prev => ({
            ...prev,
            searchSyslogs: { ...prev.searchSyslogs, visible: false }
        }));

        loadNetflowData(page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    };

    const handleApplyEventsPerPage = () => {
        loadNetflowData(page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters); // Reset to page 1 when page size changes
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
                        >
                            <TfiLayoutListThumb className="defaultIcon" />
                            <IoPieChartSharp className="hoverIcon" />
                        </button>
                    ) : (
                        <button
                            className="iconButton"
                            onClick={() => setView("list")}
                        >
                            <IoPieChartOutline className="defaultIcon" />
                            <TfiLayoutListThumbAlt className="hoverIcon" />
                        </button>
                    )}
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
                {!loading && !error && (
                    view === "list" ? (
                        <div>
                            <div className="syslogsTableContainer">
                                <EventsTable
                                    currentUser={currentUser}
                                    data={eventsData}
                                    columns={baseColumns}
                                    signalSource={dataSource}
                                    onDownload={(downloadFn) => (downloadRef.current = downloadFn)}
                                    onRowSelectChange={handleRowSelectChange}
                                />
                            </div>
                            <div className="paginationContainer">
                                <div style={{ paddingLeft: '20px' }}>
                                    <span>Events Per Page: </span>
                                    <input
                                        type="number"
                                        id="syslogsPerPage"
                                        value={pageSize}
                                        min="1"
                                        onChange={handlePageSizeChange}
                                        style={{
                                            width: '30px',
                                            background: 'none',
                                            marginRight: '6px',
                                            border: 'none',
                                            outline: 'none',
                                            paddingLeft: '10px',
                                            padding: '5px',
                                            borderRadius: '5px',
                                            color: 'var(--textColor)'
                                        }}
                                    />
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '20px',
                                    marginTop: '10px'
                                }}>
                                    <Pagination
                                        count={totalPages}
                                        page={page}
                                        onChange={(event, value) => setPage(value)}
                                        shape="rounded"
                                        color="primary"
                                        sx={{
                                            '& .MuiPaginationItem-root': {
                                                color: 'var(--textColor)',
                                            }
                                        }}
                                    />
                                </div>
                                <div style={{ paddingRight: '20px' }}>
                                    <span>Total Entries: {totalEvents}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <NetflowChart />
                    )
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
