import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import kcFetch from '../components/misc/kcFetch';
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import ChartView from '../components/misc/ChartView.js';
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import SearchTime from '../components/misc/SearchTime.js';
import Pagination from '@mui/material/Pagination';
import SyslogSignalFilters from '../components/signals/filters/SyslogSignals.js';
import TrapSignalFilters from '../components/signals/filters/TrapSignals.js';
import SyslogMnemonic from '../components/signals/config/SyslogMnemonic.js';
import SyslogSeverity from '../components/signals/config/SyslogSeverity.js';
import StatefulSyslogs from '../components/signals/config/StatefulSyslogs.js';
import StatefulTraps from '../components/signals/config/StatefulTraps.js';
import { MdOutlineRuleFolder, MdRuleFolder } from "react-icons/md";
import { PiBatteryWarningVerticalBold, PiBatteryWarningVerticalFill } from "react-icons/pi";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";
import { IoPieChartOutline, IoPieChartSharp, IoRefreshCircleOutline, IoRefreshCircleSharp } from "react-icons/io5";
import { BsPass, BsPassFill } from "react-icons/bs";

function Signals({ currentUser, setDashboardTitle, keycloak }) {
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
        syslogSeverity: { visible: false, position: { x: 0, y: 0 } },
        syslogSignalFilters: { visible: false, position: { x: 0, y: 0 } },
        trapSignalFilters: { visible: false, position: { x: 0, y: 0 } },
        search: { visible: false, position: { x: 0, y: 0 } },
        time: { visible: false, position: { x: 0, y: 0 } },
        statefulSyslogRules: { visible: false, position: { x: 0, y: 0 } },
        statefulTrapRules: { visible: false, position: { x: 0, y: 0 } },
        syslogMnemonics: { visible: false, position: { x: 0, y: 0 } },
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);
    const [totalEvents, setTotalEvents] = useState(0);
    const baseColumns = {
        syslogs: [
            { label: 'Start Time', value: 'startTime' },
            { label: 'End Time', value: 'endTime' },
            { label: 'Device', value: 'device' },
            { label: 'Severity', value: 'severity' },
            { label: 'Rule', value: 'rule' },
            { label: 'Mnemonic', value: 'mnemonic' },
            { label: 'Description', value: 'description' },
        ],
        snmptraps: [
            { label: 'Start Time', value: 'startTime' },
            { label: 'End Time', value: 'endTime' },
            { label: 'Device', value: 'device' },
            { label: 'SysUpTime', value: 'sysUpTime' },
            { label: 'Severity', value: 'severity' },
            { label: 'Rule', value: 'rule' },
            { label: 'Trap OID', value: 'snmpTrapOid' },
            { label: 'Description', value: 'description' },
        ],
    };
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState(baseColumns);

    useEffect(() => {
        setColumnConfigs(prev => ({
            ...prev,
            [dataSource]: [
                ...(baseColumns[dataSource] || []),
                ...(selectedTags || []).map(tag => ({
                    label: tag,      // label shown in table header
                    value: tag,      // field key in data
                })),
            ],
        }));
    }, [selectedTags, dataSource]);

    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [filters, setFilters] = useState({});
    const totalPages = Math.ceil(totalEvents / pageSize);
    const [view, setView] = useState("list")

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

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setPage(1);
        //loadData(keycloak, dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
        setColumnConfigs(baseColumns);
    };

    const handleTimeRangeChange = (start, end) => {
        setStartTime(start);
        setEndTime(end);
    };

    useEffect(() => {
        console.log('Testing in mounting:', selectedTags)
        //loadData(keycloak, dataSource, page, pageSize, startTime?.toISOString(), endTime?.toISOString(), filters);
    }, [keycloak, dataSource, page, pageSize, startTime, endTime, filters]);

    const onTagChange = (tagName) => {
        setColumnConfigs(prev => {
            const list = prev[dataSource] || []
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

    const handleSearchFilters = (newFilters) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [dataSource]: newFilters,
        }));
        console.log(`New Filters for ${dataSource}:`, newFilters);
    };


    const handleRowSelectChange = (newSelectedRows) => {
        console.log('Testing!!!');
    };

    return (
        <div className="mainContainer" ref={dropdownWrapperRef}>
            <div className="mainContainerHeader">
                <div className="headerTitles">
                    <h2 className={`eventsTitleHeader ${dataSource === 'syslogs' ? 'eventsTitleHeaderActive' : ''} `} onClick={() => handleHeaderClick('syslogs')}> Syslogs </h2>
                    <h2 className={`eventsTitleHeader ${dataSource === 'snmptraps' ? 'eventsTitleHeaderActive' : ''} `} onClick={() => handleHeaderClick('snmptraps')} > SNMP Traps </h2>
                </div>
                <div className="mainContainerButtons">
                    {view === "list" ? (<>
                        <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => setView("chart")} >
                            <TfiLayoutListThumb className="defaultIcon" />
                            <IoPieChartSharp className="hoverIcon" />
                        </button> </>) : (<>
                            <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => setView("list")} >
                                <IoPieChartOutline className="defaultIcon" />
                                <TfiLayoutListThumbAlt className="hoverIcon" />
                            </button> </>)}
                    {view === "list" && dataSource === "syslogs" && (
                        <>
                            <button
                                className={`iconButton ${dropdowns.syslogSeverity.visible ? "active" : ""}`}
                                onClick={(event) => handleButtonClick(event, "syslogSeverity")}
                            >
                                <PiBatteryWarningVerticalBold className="defaultIcon" />
                                <PiBatteryWarningVerticalFill className="hoverIcon" />
                            </button>
                            <button
                                className={`iconButton ${dropdowns.statefulSyslogRules.visible ? "active" : ""}`}
                                onClick={(event) => handleButtonClick(event, "statefulSyslogRules")}
                            >
                                <MdOutlineRuleFolder className="defaultIcon" />
                                <MdRuleFolder className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.syslogSignalFilters.visible ? "active" : ""}`}
                                onClick={() => handleButtonClick("syslogSignalFilters")}
                            >
                                <RiFilterLine className="defaultIcon" />
                                <RiFilterFill className="hoverIcon" />
                            </button>
                        </>
                    )}
                    {view === "list" && dataSource === "snmptraps" && (
                        <>
                            <button
                                className={`iconButton ${dropdowns.statefulTrapRules.visible ? "active" : ""}`}
                                onClick={(event) => handleButtonClick(event, "statefulTrapRules")}
                            >
                                <MdOutlineRuleFolder className="defaultIcon" />
                                <MdRuleFolder className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.trapSignalFilters.visible ? "active" : ""}`}
                                onClick={() => handleButtonClick("trapSignalFilters")}
                            >
                                <RiFilterLine className="defaultIcon" />
                                <RiFilterFill className="hoverIcon" />
                            </button>
                        </>
                    )}
                    <button
                        className={`iconButton ${dropdowns.time.visible ? "active" : ""}`}
                        onClick={(event) => handleButtonClick(event, "time")}
                    >
                        <FaRegClock className="defaultIcon hasFilters" />
                        <FaClock className="hoverIcon" />
                    </button>
                    <button className="iconButton">
                        <RiDownloadCloudLine className="defaultIcon" />
                        <RiDownloadCloudFill className="hoverIcon" />
                    </button>
                </div>
            </div>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (view === 'chart' ? (
                    <div className="syslogsTableContainer">
                        <ChartView keycloak={keycloak} currentUser={currentUser} source='signals' dataSource={dataSource} selectedTags={baseColumns} />
                    </div>
                ) : (
                    <div className="syslogsTableContainer">
                        <EventsTable currentUser={currentUser} dataSource={dataSource} data={eventsData} columns={columnConfigs[dataSource]} signalSource={dataSource} onDownload={(downloadFn) => (downloadRef.current = downloadFn)} onRowSelectChange={handleRowSelectChange} />
                    </div>
                ))}
            </div>
            <div ref={dropdownMenuRef}>
                <div
                    className={`dropdownMenu ${dropdowns.syslogMnemonics.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <SyslogMnemonic keycloak={keycloak} onSearch={(f) => handleSearchFilters(f)} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.syslogSeverity.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <SyslogSeverity keycloak={keycloak} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.statefulSyslogRules.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <StatefulSyslogs keycloak={keycloak} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.statefulTrapRules.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <StatefulTraps keycloak={keycloak} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.syslogSignalFilters.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <SyslogSignalFilters keycloak={keycloak} onSearch={(f) => handleSearchFilters(f)} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.trapSignalFilters.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <TrapSignalFilters keycloak={keycloak} onSearch={(f) => handleSearchFilters(f)} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.time.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto' }} >
                    <SearchTime startTime={startTime} endTime={endTime} onTimeRangeChange={handleTimeRangeChange} />
                </div>
            </div>
        </div>
    );
}

export default Signals;
