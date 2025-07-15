import React, { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
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
import UploadMIB from '../components/snmptraps/UploadMIB.js';
import { PiUploadBold, PiUploadFill } from "react-icons/pi";
import SnmpTrapOid from '../components/snmptraps/SnmpTrapOid.js';
import TrapTags from '../components/snmptraps/TrapTags.js';
import Pagination from '@mui/material/Pagination';

function EventsDatabase({ currentUser, setDashboardTitle }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [selectedTags, setSelectedTags] = useState([]);
    const [dataSource, setDataSource] = useState('syslogs');
    const [eventsData, setEventsData] = useState([]);
    const downloadRef = useRef(null);
    const [dropdowns, setDropdowns] = useState({
        syslogTagsConfig: { visible: false, position: { x: 0, y: 0 } },
        regExConfig: { visible: false, position: { x: 0, y: 0 } },
        searchSyslogs: { visible: false, position: { x: 0, y: 0 } },
        timerangeFilters: { visible: false, position: { x: 0, y: 0 } },
        showSyslogTags: { visible: false, position: { x: 0, y: 0 } },
        injectSyslog: { visible: false, position: { x: 0, y: 0 } },
        mnemonics: { visible: false, position: { x: 0, y: 0 } },
        MIBFiles: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapOids: { visible: false, position: { x: 0, y: 0 } },
        trapTags: { visible: false, position: { x: 0, y: 0 } },
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

    const [columnConfigs, setColumnConfigs] = useState(baseColumns);

    useEffect(() => {
        setColumnConfigs(prev => ({
            ...prev,
            [dataSource]: [...(baseColumns[dataSource] || []), ...selectedTags],
        }));
    }, [selectedTags, dataSource]);
    const [mnemonics, setMnemonics] = useState([]);
    const [regExpressions, setRegExpressions] = useState([]);
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [tagNames, setTagNames] = useState([]);
    const [devices, setDevices] = useState([]);
    const [timeRange, setTimeRange] = useState('last_4_hour');
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

    const loadData = (
        dataSource,
        page = 1,
        pageSize = 20,
        timeRange2 = timeRange,
        startTime = null,
        endTime = null,
        filters = {}  // Renamed from selectedTags to filters
    ) => {
        setEventsData(null);
        setLoading(true);

        let url = '';
        if (dataSource === 'syslogs') {
            url = `/syslogs/?page=${page}&page_size=${pageSize}`;
            if (timeRange) {
                url += `&time_range=${timeRange}`;
            } else if (startTime && endTime) {
                url += `&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
            }
        } else if (dataSource === 'snmptraps') {
            url = `/traps/?page=${page}&page_size=${pageSize}`;
            if (timeRange) {
                url += `&time_range=${timeRange}`;
            } else if (startTime && endTime) {
                url += `&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`;
            }
        } else if (dataSource === 'netflow') {
            url = `/netflow/?page=${page}&page_size=${pageSize}`;
        }

        // Build URLSearchParams from filters
        const query = new URLSearchParams();

        if (filters.agent?.length) {
            filters.agent.forEach(agent => query.append('agent', agent));
        }

        if (filters.mnemonic?.length) {
            filters.mnemonic.forEach(m => query.append('mnemonic', m));
        }

        if (filters.snmpTrapOid?.length) {
            filters.snmpTrapOid.forEach(oid => query.append('snmpTrapOid', oid));
        }

        if (filters.tags) {
            for (const [key, values] of Object.entries(filters.tags)) {
                values.forEach(value => query.append(`${key}`, value));
            }
        }

        // Add built query string
        url += `&${query.toString()}`;

        apiClient
            .get(url)
            .then(response => {
                let results = [];
                if (response.data && response.data.results) {
                    results = response.data.results.map(item => item._source || item);
                    setTotalEvents(response.data.total || 0);
                } else if (response.data && Array.isArray(response.data)) {
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
            console.error('Error fetching agent data:', error);
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

    const fetchAgents = async () => {
        try {
            const response = await apiClient.get('/devices/brief/');
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

    const handleRowSelectChange = (newSelectedRows) => {
        console.log('Testing!!!');
    };

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setPage(1); // Reset to first page when changing source
        loadData(source, 1, pageSize); // Load page 1 with correct size

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
        if (!start || !end) return;

        // Format dates to ISO string
        const startTime = new Date(start).toISOString();
        const endTime = new Date(end).toISOString();

        loadData('syslogs', 1, 10, null, startTime, endTime);
    };

    const handleTimeRangeSelect = (range) => {
        loadData('syslogs', 1, pageSize, range, timeRange, null);
    };

    const handleSearchAndCloseDropdown = (filters) => {
        console.log('Selected tags:', filters);

        // Close the dropdown (if needed)
        setDropdowns(prev => ({
            ...prev,
            searchSyslogs: { ...prev.searchSyslogs, visible: false }
        }));

        // Trigger data loading
        loadData('syslogs', 1, 19, timeRange, null, null, filters);
    };

    useEffect(() => {
        loadData(dataSource, page, pageSize, timeRange);

        if (dataSource === 'syslogs') {
            fetchMnemonics();
            fetchRegEx();
        } else if (dataSource === 'snmptraps') {
            fetchSnmpTrapOids();
        }
    }, [page, dataSource, pageSize]);

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
        loadData(dataSource, 1, pageSize); // Reset to page 1 when page size changes
    };

    const handlePageSizeChange = (event) => {
        const value = parseInt(event.target.value, 10);
        setPageSize(isNaN(value) || value < 1 ? 1 : value);
    };

    const handleSyslogTagsChange = (selectedTags) => {
        console.log('Selected tags:', selectedTags)
    };

    return (
        <div className="mainContainer">
            <div className="mainContainerHeader">
                <div className="headerTitles">
                    <h2
                        className={`eventsTitleHeader ${dataSource === 'syslogs' ? 'eventsTitleHeaderActive' : ''}`}
                        onClick={() => handleHeaderClick('syslogs')}
                    >
                        Syslogs
                    </h2>
                    <h2
                        className={`eventsTitleHeader ${dataSource === 'snmptraps' ? 'eventsTitleHeaderActive' : ''}`}
                        onClick={() => handleHeaderClick('snmptraps')}
                    >
                        SNMP Traps
                    </h2>
                    <h2
                        className={`eventsTitleHeader ${dataSource === 'netflow' ? 'eventsTitleHeaderActive' : ''}`}
                        onClick={() => handleHeaderClick('netflow')}
                    >
                        Netflow
                    </h2>
                </div>
                <div className="mainContainerButtons">
                    {dataSource === 'syslogs' && (
                        <>

                            <button
                                className={`iconButton ${dropdowns.mnemonics.visible ? 'active' : ''}`}
                                onClick={(event) => handleButtonClick(event, 'mnemonics')}
                            >
                                <MdBookmarkBorder className="defaultIcon" />
                                <MdBookmark className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${dropdowns.regExConfig.visible ? 'active' : ''}`}
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
                                className={`iconButton ${dropdowns.MIBFiles.visible ? 'active' : ''}`}
                                onClick={(event) => handleButtonClick(event, 'MIBFiles')}
                            >
                                <PiUploadBold className="defaultIcon" />
                                <PiUploadFill className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${dropdowns.snmpTrapOids.visible ? 'active' : ''}`}
                                onClick={(event) => handleButtonClick(event, 'snmpTrapOids')}
                            >
                                <MdBookmarkBorder className="defaultIcon" />
                                <MdBookmark className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${dropdowns.regExConfig.visible ? 'active' : ''}`}
                                style={{ marginRight: '20px' }}
                                onClick={(event) => handleButtonClick(event, 'trapTags')}
                            >
                                <RiAddCircleLine className="defaultIcon" />
                                <RiAddCircleFill className="hoverIcon" />
                            </button>
                        </>
                    )}
                    <button
                        className={`iconButton ${dropdowns.showSyslogTags.visible ? 'active' : ''}`}
                        onClick={(event) => handleButtonClick(event, 'showSyslogTags')}
                    >
                        <HiOutlineViewColumns
                            className={`defaultIcon ${selectedTags.length > 0 ? 'hasFilters' : 'noFilters'}`}
                        />
                        <HiViewColumns className="hoverIcon" />
                    </button>
                    <button
                        className={`iconButton ${dropdowns.searchSyslogs.visible ? 'active' : ''}`}
                        onClick={(event) => handleButtonClick(event, 'searchSyslogs')}
                    >
                        <RiFilterLine className="defaultIcon" />
                        <RiFilterFill
                            className="hoverIcon"
                        />
                    </button>
                    <button
                        className="iconButton"
                        onClick={(event) => handleButtonClick(event, 'timerangeFilters')}
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
                    <div className="syslogsTableContainer">
                        <EventsTable
                            currentUser={currentUser}
                            data={eventsData}
                            columns={columnConfigs[dataSource]} // Pass correct columns based on data source
                            signalSource={dataSource} // Pass current source to EventsTable
                            onDownload={(downloadFn) => (downloadRef.current = downloadFn)}
                            onRowSelectChange={handleRowSelectChange}
                        />
                    </div>
                )}
                <div className="paginationContainer" >

                    <div style={{ paddingLeft: '20px' }}>
                        <span>Events Per Page: </span>
                        <input
                            type="number"
                            id="syslogsPerPage"
                            value={pageSize}
                            min="1"
                            onChange={handlePageSizeChange}
                            style={{ width: '30px', background: 'none', marginRight: '6px', border: 'none', outline: 'none', paddingLeft: '10px', padding: '5px', borderRadius: '5px', color: 'var(--textColor)' }}
                        />

                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '10px' }}>
                        <Pagination
                            count={totalPages}
                            page={page}
                            onChange={(event, value) => setPage(value)}
                            shape="rounded"
                            color="primary" // optional: change to "secondary", or customize with sx
                            sx={{
                                '& .MuiPaginationItem-root': {
                                    color: 'var(--textColor)', // your custom theme color
                                }
                            }}
                        /></div>
                    <div style={{ paddingRight: '20px' }}><span>Total Entries: {totalEvents}</span></div>
                </div>
            </div>
            <div
                className={`dropdownMenu ${dropdowns.searchSyslogs.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
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
                className={`dropdownMenu ${dropdowns.regExConfig.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '650px' }}
            >
                <RegExConfig
                    currentUser={currentUser}
                    regExpressions={regExpressions}
                    mnemonics={mnemonics}
                    hostnames={devices}
                    devices={devices}
                    isLoading={loading}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.timerangeFilters.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: 'auto' }}
            >
                <SearchTime
                    onTimeRangeSelect={handleTimeRangeSelect}
                    onTimeRangeChange={handleTimeRangeChange}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.showSyslogTags.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '280px' }}>
                <SyslogTags
                    dataSource={dataSource}
                    selectedTags={selectedTags}
                    onTagChange={(updated) => setSelectedTags(updated)}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.MIBFiles.visible ? 'dropdownVisible' : 'dropdownHidden'}`}>
                <UploadMIB
                    currentUser={currentUser}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.snmpTrapOids.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
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
                className={`dropdownMenu ${dropdowns.trapTags.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: 'auto',
                    maxHeight: '740px',
                    overflow: 'hidden',
                    marginRight: '70px',
                }}>
                <TrapTags
                    currentUser={currentUser}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.mnemonics.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
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
    );
}

export default EventsDatabase;
