import React, { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import TelemetryContent from '../components/misc/TelemetryContent.js';
import apiClient from '../components/misc/AxiosConfig.js';
import { MdBookmarkBorder, MdBookmark } from "react-icons/md";
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import Mnemonics from '../components/syslogs/Mnemonics.js';
import SyslogTags from '../components/syslogs/TagColumns.js';
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import SearchTime from '../components/misc/SearchTime.js';
import FilterSyslogs from '../components/syslogs/FilterSyslogs.js';
import RegExConfig from '../components/syslogs/RegExConfig.js';
import TelemetryStats from '../components/telemetry/TelemetryStats.js';
import UploadMIB from '../components/snmptraps/UploadMIB.js';
import { PiUploadBold, PiUploadFill } from "react-icons/pi";
import SnmpTrapOid from '../components/snmptraps/SnmpTrapOid.js';
import TrapTags from '../components/snmptraps/TrapTags.js';
import Pagination from '@mui/material/Pagination';
import { now, getLocalTimeZone } from '@internationalized/date';


function EventsDatabase({ currentUser, setDashboardTitle }) {
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
        syslogTagsConfig: { visible: false, position: { x: 0, y: 0 } },
        regExConfig: { visible: false, position: { x: 0, y: 0 } },
        searchSyslogs: { visible: false, position: { x: 0, y: 0 } },
        searchTime: { visible: false, position: { x: 0, y: 0 } },
        showSyslogTags: { visible: false, position: { x: 0, y: 0 } },
        injectSyslog: { visible: false, position: { x: 0, y: 0 } },
        mnemonics: { visible: false, position: { x: 0, y: 0 } },
        MIBFiles: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapOids: { visible: false, position: { x: 0, y: 0 } },
        trapTags: { visible: false, position: { x: 0, y: 0 } },
        TelemetryStats: { visible: false, position: { x: 0, y: 0 } },
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalEvents, setTotalEvents] = useState(0);
    const baseColumns = {
        syslogs: ['timestamp', 'device', 'severity', 'mnemonic', 'message'],
        snmptraps: ['timestamp', 'device', 'sysUpTime', 'snmpTrapOid', 'content'],
        netflow: [
            'timestamp',
            'device',
            'source_addr',
            'source_port',
            'dest_addr',
            'dest_port',
            'protocol',
            'input_snmp',
            'output_snmp',
            'bytes_count',
            'packets_count',
        ],
    };

    const [selectedDevice, setSelectedDevice] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState(baseColumns);

    useEffect(() => {
        setColumnConfigs(prev => ({
            ...prev,
            [dataSource]: [...(baseColumns[dataSource] || []), ...selectedTags],
        }));
    }, [selectedTags]);

    const [mnemonics, setMnemonics] = useState([]);
    const [regExpressions, setRegExpressions] = useState([]);
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [tagNames, setTagNames] = useState([]);
    const [devices, setDevices] = useState([]);
    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [filters, setFilters] = useState({});
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

    useEffect(() => {
        setDashboardTitle("Events Dashboard");
        return () => setDashboardTitle(''); // Clean up when navigating away
    }, [setDashboardTitle]);

    // Helper function to format ISO without `[Zone]`
    const formatDateForBackend = (zonedDateTime) => {
        const iso = zonedDateTime.toString(); // e.g. 2025-08-01T01:24:17.217+02:00
        return iso;
    };


    const loadData = (
        dataSource,
        page = 1,
        pageSize = 20,
        startTime = startTime,
        endTime = endTime,
        filters = {}
    ) => {
        if (dataSource === 'telemetry') {
            setEventsData([]);
            setTotalEvents(0);
            return;
        }

        setEventsData(null);
        setLoading(true);

        let url = '';
        if (dataSource === 'syslogs') {
            url = `/syslogs/?page=${page}&page_size=${pageSize}`;
            if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
            if (endTime) url += `&end_time=${encodeURIComponent(endTime)}`;
        } else if (dataSource === 'snmptraps') {
            url = `/traps/?page=${page}&page_size=${pageSize}`;
            if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
            if (endTime) url += `&end_time=${encodeURIComponent(endTime)} `;
        } else if (dataSource === 'netflow') {
            url = `/netflow/?page=${page}&page_size=${pageSize}`;
            if (startTime) url += `&start_time=${encodeURIComponent(startTime)}`;
            if (endTime) url += `&end_time=${encodeURIComponent(endTime)} `;
        }

        const query = new URLSearchParams();

        if (filters.device?.length) {
            filters.device.forEach(device => query.append('device', device));
        }

        if (filters.mnemonic?.length) {
            filters.mnemonic.forEach(m => query.append('mnemonic', m));
        }

        if (filters.snmpTrapOid?.length) {
            filters.snmpTrapOid.forEach(oid => query.append('snmpTrapOid', oid));
        }

        if (filters.tags) {
            for (const [key, values] of Object.entries(filters.tags)) {
                const cleanKey = key.trim();
                values.forEach(value => query.append(cleanKey, value));
            }
        }

        if (query.toString()) {
            url += `&${ query.toString() } `;
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
                console.error('Error fetching data:', error);
                setError('Error fetching data');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const fetchMnemonics = async () => {
        try {
            const response = await apiClient.get('/syslogs/mnemonics/');
            const mnemonics = response.data.map((mnemonic) => ({
                id: mnemonic.id,
                name: mnemonic.name,
                label: mnemonic.name,
            }));
            setMnemonics(mnemonics);
        } catch (error) {
            console.error('Error fetching mnemonic data:', error);
        }
    };

    const fetchSnmpTrapOids = async () => {
        try {
            const response = await apiClient.get('/traps/trapOids/');
            const trapOids = response.data.map((trapOid) => ({
                id: trapOid.id,
                label: trapOid.label,
            }));
            setSnmpTrapOids(trapOids);
        } catch (error) {
            console.error('Error fetching SNMP Trap Oid data:', error);
        }
    };

    const fetchRegEx = async () => {
        try {
            const response = await apiClient.get('/syslogs/regex/');
            const regExObject = response.data.map((regEx) => ({
                id: regEx.id,
                label: regEx.name,
                name: regEx.name,
            }));
            const tagNames = response.data.map((tag) => tag.name);
            setRegExpressions(regExObject);
            console.log('List of Tag Names:', tagNames);
        } catch (error) {
            console.error('Error fetching tag names:', error);
        }
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



    const handleRowSelectChange = (newSelectedRows) => {
        console.log('Testing!!!');
    };

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setPage(1); // Reset to first page when changing source
        loadData(dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters); // Load page 1 with correct size
        setColumnConfigs(baseColumns); // Reset selected tags based on new source

        // Fetch specific data depending on selected source
        if (source === 'syslogs') {
            fetchMnemonics();
            fetchRegEx();
        } else if (source === 'snmptraps') {
            fetchSnmpTrapOids();
        }
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
        loadData(dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters); 
    };

    const handleSearchAndCloseDropdown = (filters) => {
        console.log('Selected tags:', filters);

        setDropdowns(prev => ({
            ...prev,
            searchSyslogs: { ...prev.searchSyslogs, visible: false }
        }));

        loadData(dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters); 
    };

    const handleTagsEditing = () => {
        fetchRegEx();
        setDropdowns(prev => ({
            ...prev,
            regExConfig: { ...prev.regExConfig, visible: false }
        }));
    }


    useEffect(() => {
        loadData(dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);

        if (dataSource === 'syslogs') {
            fetchMnemonics();
            fetchRegEx();
        } else if (dataSource === 'snmptraps') {
            fetchSnmpTrapOids();
        }
    }, [page, dataSource, startTime, endTime, pageSize]);

    const onTagChange = (tagName) => {
        setColumnConfigs(prev => {
            const list = prev[dataSource] || []

            // if you want toggle behavior:
            const already = list.includes(tagName)
            const newList = already
                ? list.filter(t => t !== tagName)
                : [...list, tagName]

            return {
                ...prev,
                [dataSource]: newList
            }
        })
    }

    const handleApplyEventsPerPage = () => {
        loadData(dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters); // Reset to page 1 when page size changes
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
                        className={`eventsTitleHeader ${ dataSource === 'syslogs' ? 'eventsTitleHeaderActive' : '' } `}
                        onClick={() => handleHeaderClick('syslogs')}
                    >
                        Syslogs
                    </h2>
                    <h2
                        className={`eventsTitleHeader ${ dataSource === 'snmptraps' ? 'eventsTitleHeaderActive' : '' } `}
                        onClick={() => handleHeaderClick('snmptraps')}
                    >
                        SNMP Traps
                    </h2>
                    <h2
                        className={`eventsTitleHeader ${ dataSource === 'netflow' ? 'eventsTitleHeaderActive' : '' } `}
                        onClick={() => handleHeaderClick('netflow')}
                    >
                        Netflow
                    </h2>
                    <h2
                        className={`eventsTitleHeader ${ dataSource === 'telemetry' ? 'eventsTitleHeaderActive' : '' } `}
                        onClick={() => handleHeaderClick('telemetry')}
                    >
                        Telemetry
                    </h2>
                </div>
                <div className="mainContainerButtons">
                    {dataSource === 'syslogs' && (
                        <>

                            <button
                                className={`iconButton ${ dropdowns.mnemonics.visible ? 'active' : '' } `}
                                onClick={(event) => handleButtonClick(event, 'mnemonics')}
                            >
                                <MdBookmarkBorder className="defaultIcon" />
                                <MdBookmark className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${ dropdowns.regExConfig.visible ? 'active' : '' } `}
                                style={{ marginRight: '20px' }}
                                onClick={(event) => handleButtonClick(event, 'regExConfig')}
                            >
                                <RiAddCircleLine className="defaultIcon" />
                                <RiAddCircleFill className="hoverIcon" />
                            </button>
                        </>
                    )}
                    {dataSource === 'snmptraps' && (
                        <>
                            <button
                                className={`iconButton ${ dropdowns.MIBFiles.visible ? 'active' : '' } `}
                                onClick={(event) => handleButtonClick(event, 'MIBFiles')}
                            >
                                <PiUploadBold className="defaultIcon" />
                                <PiUploadFill className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${ dropdowns.snmpTrapOids.visible ? 'active' : '' } `}
                                onClick={(event) => handleButtonClick(event, 'snmpTrapOids')}
                            >
                                <MdBookmarkBorder className="defaultIcon" />
                                <MdBookmark className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${ dropdowns.regExConfig.visible ? 'active' : '' } `}
                                style={{ marginRight: '20px' }}
                                onClick={(event) => handleButtonClick(event, 'trapTags')}
                            >
                                <RiAddCircleLine className="defaultIcon" />
                                <RiAddCircleFill className="hoverIcon" />
                            </button>
                        </>
                    )}
                    {dataSource !== 'netflow' ? (
                        <button
                            className={`iconButton ${ dropdowns.showSyslogTags.visible ? 'active' : '' } `}
                            onClick={(event) => handleButtonClick(event, 'showSyslogTags')}
                        >
                            <HiOutlineViewColumns
                                className={`defaultIcon ${ selectedTags.length > 0 ? 'hasFilters' : 'noFilters' } `}
                            />
                            <HiViewColumns className="hoverIcon" />
                        </button>
                    ) : (
                        <button
                            className={`iconButton ${ dropdowns.searchSyslogs.visible ? 'active' : '' } `}
                            onClick={(event) => handleButtonClick(event, 'searchSyslogs')}
                        >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill className="hoverIcon" />
                        </button>
                    )}
                    {dataSource === 'telemetry' ? (
                        <button
                            className={`iconButton ${ dropdowns.searchSyslogs.visible ? 'active' : '' } `}
                            onClick={(event) => handleButtonClick(event, 'TelemetryStats')}
                        >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill
                                className="hoverIcon"
                            />
                        </button>
                    ) : (
                        <button
                            className={`iconButton ${ dropdowns.searchSyslogs.visible ? 'active' : '' } `}
                            onClick={(event) => handleButtonClick(event, 'searchSyslogs')}
                        >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill
                                className="hoverIcon"
                            />
                        </button>
                    )}

                    <button
                        className="iconButton"
                        onClick={(event) => handleButtonClick(event, 'searchTime')}
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
                    dataSource === 'telemetry' ? (
                        <TelemetryContent currentUser={currentUser} selectedDevice={selectedDevice} />
                    ) : (
                        <div>
                            <div className="syslogsTableContainer">
                                <EventsTable
                                    currentUser={currentUser}
                                    data={eventsData}
                                    columns={columnConfigs[dataSource]} // Pass correct columns based on data source
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
                    )
                )}

            </div>
            <div ref={dropdownMenuRef}>
                <div
                    className={`dropdownMenu ${ dropdowns.searchSyslogs.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{ width: '420px' }}
                >
                    <FilterSyslogs
                        source={dataSource}
                        tags={tagNames}
                        devices={devices}
                        mnemonics={mnemonics}
                        onSelectedTagsChange={handleSyslogTagsChange}
                        onSelectedTagsSearch={handleSearchAndCloseDropdown}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.regExConfig.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{ width: '700px' }}
                >
                    <RegExConfig
                        currentUser={currentUser}
                        regExpressions={regExpressions}
                        onAdd={handleTagsEditing}
                        onUpdate={handleTagsEditing}
                        onDelete={handleTagsEditing}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.searchTime.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{ width: 'auto' }}
                >
                    <SearchTime
                        startTime={startTime}
                        endTime={endTime}
                        onTimeRangeChange={handleTimeRangeChange}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.showSyslogTags.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{ width: '280px' }}>
                    <SyslogTags
                        dataSource={dataSource}
                        selectedTags={selectedTags}
                        onTagChange={(updated) => setSelectedTags(updated)}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.MIBFiles.visible ? 'dropdownVisible' : 'dropdownHidden' } `}>
                    <UploadMIB
                        currentUser={currentUser}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.snmpTrapOids.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{
                        width: 'auto',
                        maxHeight: '740px',
                        overflow: 'hidden',
                    }}>
                    <SnmpTrapOid
                        currentUser={currentUser}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.TelemetryStats.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
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
                <div
                    className={`dropdownMenu ${ dropdowns.trapTags.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{
                        width: 'auto',
                        maxHeight: '740px',
                        overflow: 'hidden',
                    }}>
                    <TrapTags
                        currentUser={currentUser}
                    />
                </div>
                <div
                    className={`dropdownMenu ${ dropdowns.mnemonics.visible ? 'dropdownVisible' : 'dropdownHidden' } `}
                    style={{
                        width: 'auto',
                        maxHeight: '740px',
                        overflow: 'hidden',
                    }}>
                    <Mnemonics
                        currentUser={currentUser}
                        mnemonics={mnemonics}
                        entityOptions={regExpressions}
                    />
                </div>
            </div>
        </div>
    );
}

export default EventsDatabase;
