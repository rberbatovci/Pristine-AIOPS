import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import ChartView from '../components/misc/ChartView.js';

import { FaClock, FaRegClock } from "react-icons/fa";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import { PiBatteryWarningVerticalBold, PiBatteryWarningVerticalFill } from "react-icons/pi";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";
import { IoPieChartOutline, IoPieChartSharp } from "react-icons/io5";
import { MdOutlineRuleFolder, MdRuleFolder } from "react-icons/md";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";

import SyslogTags from '../components/syslogs/Tags.js';
import SnmpTrapTags from '../components/snmptraps/SnmpTrapTags.js';
import SearchTime from '../components/misc/SearchTime.js';
import SyslogSignalFilters from '../components/signals/filters/SyslogSignals.js';
import TrapSignalFilters from '../components/signals/filters/TrapSignals.js';
import SyslogMnemonic from '../components/signals/config/SyslogMnemonic.js';
import SyslogSeverity from '../components/signals/config/SyslogSeverity.js';
import StatefulSyslogs from '../components/signals/config/StatefulSyslogs.js';
import StatefulTraps from '../components/signals/config/StatefulTraps.js';

import { useSyslogTags } from '../hooks/useSyslogTags';
import { useSnmpTrapTags } from '../hooks/useSnmpTrapTags';
import { useMnemonics } from '../hooks/useMnemonics.js';
import { useDevices } from '../hooks/useDevices.js';
import { useSignalData } from '../hooks/useSignalData.js';
import { useSnmpTrapOids } from '../hooks/useSnmpTrapOids.js';
import { useStatefulSyslogRules } from '../hooks/useStatefulSyslogRules.js';
import { useStatefulSnmpTrapRules } from '../hooks/useStatefulSnmpTrapRules.js';

function Signals({ currentUser, setDashboardTitle, keycloak, showNotification }) {
    const { signalData, totalSignals, totalPages, loading, error, loadData } = useSignalData();
    const [selectedTags, setSelectedTags] = useState([]);
    const [dataSource, setDataSource] = useState('syslogs');
    const [eventsData, setEventsData] = useState([]);
    const downloadRef = useRef(null);
    const dropdownWrapperRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [dropdowns, setDropdowns] = useState({
        syslogSeverity: { visible: false, position: { x: 0, y: 0 } },
        syslogTags: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapTags: { visible: false, position: { x: 0, y: 0 } },
        syslogSignalFilters: { visible: false, position: { x: 0, y: 0 } },
        trapSignalFilters: { visible: false, position: { x: 0, y: 0 } },
        search: { visible: false, position: { x: 0, y: 0 } },
        time: { visible: false, position: { x: 0, y: 0 } },
        statefulSyslogRules: { visible: false, position: { x: 0, y: 0 } },
        statefulTrapRules: { visible: false, position: { x: 0, y: 0 } },
        syslogMnemonics: { visible: false, position: { x: 0, y: 0 } },
        telemetryRules: { visible: false, position: { x: 0, y: 0 } },
        telemetryFilters: { visible: false, position: { x: 0, y: 0 } },
    });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(24);
    const baseColumns = {
        syslogs: [
            { label: 'Status', value: 'status' },
            { label: 'Start Time', value: 'startTime' },
            { label: 'End Time', value: 'endTime' },
            { label: 'Device', value: 'device' },
            { label: 'Severity', value: 'severity' },
            { label: 'Rule', value: 'rule' },
        ],
        snmptraps: [
            { label: 'Status', value: 'status' },
            { label: 'Start Time', value: 'startTime' },
            { label: 'End Time', value: 'endTime' },
            { label: 'Device', value: 'device' },
            { label: 'Severity', value: 'severity' },
            { label: 'Rule', value: 'rule' },
        ],
        telemetry: [
            { label: 'Status', value: 'status' },
            { label: 'Start Time', value: 'startTime' },
            { label: 'End Time', value: 'endTime' },
            { label: 'Device', value: 'device' },
            { label: 'Severity', value: 'severity' },
            { label: 'Rule', value: 'rule' },
        ],
    };
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState(baseColumns);
    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [filters, setFilters] = useState({});
    const [view, setView] = useState("list")
    const { tags: syslogTags, loading: syslogTagsLoading, reload: reloadSyslogTags } = useSyslogTags(keycloak, false);
    const { list: snmpTrapTags, loading: snmpTrapTagsLoading, reload: reloadSnmpTrapTags } = useSnmpTrapTags(keycloak, false);
    const { mnemonics, loading: mnemonicsLoading, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { devices, loading: devicesLoading, reload: reloadDevices } = useDevices(keycloak);
    const { list: snmpTrapOids, loading: oidsLoading, loadList: reloadSnmpTrapOids } = useSnmpTrapOids(keycloak);
    const {
        rules: statefulTrapRules,
        loading: statefulTrapRulesLoading,
        error: statefulTrapRulesError,
        reload: reloadStatefulTrapRules,
    } = useStatefulSnmpTrapRules(keycloak);
    const {
        rules: statefulSyslogRules,
        loading: statefulSyslogRulesLoading,
        error: statefulSyslogRulesError,
        reload: reloadStatefulSyslogRules,
    } = useStatefulSyslogRules(keycloak);

    useEffect(() => {
        loadData(
            keycloak,
            dataSource,
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            filters
        );
    }, [keycloak, dataSource, page, startTime, endTime, filters, loadData]);

    useEffect(() => {
        setColumnConfigs(prev => ({
            ...prev,
            [dataSource]: [
                ...(baseColumns[dataSource] || []),
                ...(selectedTags || []).map(tag => ({
                    label: tag,
                    value: tag,
                })),
            ],
        }));
    }, [selectedTags, dataSource]);

    const loadSyslogFilters = () => {
        if (syslogTags.length === 0) reloadSyslogTags(keycloak);
        if (devices.length === 0) reloadDevices(keycloak);
        if (mnemonics.length === 0) reloadMnemonics(keycloak);
    };

    const loadTrapFilters = () => {
        if (devices.length === 0) reloadDevices(keycloak);
        if (snmpTrapOids.length === 0) reloadSnmpTrapOids(keycloak);
        if (snmpTrapTags.length === 0) reloadSnmpTrapTags(keycloak);
    };

    const loadStatefulSyslogRules = () => {
        if (mnemonics.length === 0) reloadMnemonics(keycloak);
        if (devices.length === 0) reloadDevices(keycloak);
        if (syslogTags.length === 0) reloadSyslogTags(keycloak);
    };

    const loadStatefulTrapRules = () => {
        if (mnemonics.length === 0) reloadMnemonics(keycloak);
        if (devices.length === 0) reloadDevices(keycloak);
        if (syslogTags.length === 0) reloadSyslogTags(keycloak);
    };

    const loadSyslogTags = () => {
        if (syslogTags.length === 0) reloadSyslogTags(keycloak);
    };

    const loadSnmpTrapTags = () => {
        if (snmpTrapTags.length === 0) reloadSnmpTrapTags(keycloak);
    };

    const handleButtonClick = (event, dropdownKey) => {
        // Close all dropdowns
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

        if (!newVisibility) return;

        switch (dropdownKey) {
            case "syslogSignalFilters":
                loadSyslogFilters();
                break;

            case "trapSignalFilters":
                loadTrapFilters();
                break;

            case "statefulSyslogRules":
                loadStatefulSyslogRules();
                break;

            case "statefulTrapRules":
                loadStatefulTrapRules();
                break;

            case "syslogTags":
                loadSyslogTags();
                break;

            case "snmpTrapTags":
                loadSnmpTrapTags();
                break;

            default:
                break;
        }
    };

    useEffect(() => {
        setDashboardTitle("Signals Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    useEffect(() => {
        console.log('Filtering for:', filters);
    }, []);

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setColumnConfigs(baseColumns);
    };

    const handleTimeRangeChange = (start, end) => {
        setStartTime(start);
        setEndTime(end);
    };

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

    useEffect(() => {
        setView("list");
    }, [dataSource]);


    const toggleView = () => {
        setView(prev => (prev === "list" ? "chart" : "list"));
    };

    const handleFiltersChange = (newFilters) => {
        console.log("Filtering for:", newFilters);
    };

    return (
        <div className="mainContainer" ref={dropdownWrapperRef}>
            <div className="mainContainerHeader">
                <div className="headerTitles">
                    <h2 className={`eventsTitleHeader ${dataSource === 'syslogs' ? 'eventsTitleHeaderActive' : ''} `} onClick={() => handleHeaderClick('syslogs')}> Syslogs </h2>
                    <h2 className={`eventsTitleHeader ${dataSource === 'snmptraps' ? 'eventsTitleHeaderActive' : ''} `} onClick={() => handleHeaderClick('snmptraps')} > SNMP Traps </h2>
                    <h2 className={`eventsTitleHeader ${dataSource === 'telemetry' ? 'eventsTitleHeaderActive' : ''} `} onClick={() => handleHeaderClick('telemetry')} > Telemetry </h2>
                </div>
                <div className="mainContainerButtons">
                    {view === "list" ? (<>
                        <button className="iconButton" style={{ marginRight: '20px' }} onClick={toggleView} >
                            <TfiLayoutListThumb className="defaultIcon" />
                            <IoPieChartSharp className="hoverIcon" />
                        </button> </>) : (<>
                            <button className="iconButton" style={{ marginRight: '20px' }} onClick={toggleView} >
                                <IoPieChartOutline className="defaultIcon" />
                                <TfiLayoutListThumbAlt className="hoverIcon" />
                            </button> </>)}
                    {dataSource === "syslogs" && (
                        <>
                            <button
                                className={`iconButton ${dropdowns.syslogSeverity.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "syslogSeverity")}
                            >
                                <PiBatteryWarningVerticalBold className="defaultIcon" />
                                <PiBatteryWarningVerticalFill className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.statefulSyslogRules.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "statefulSyslogRules")}
                            >
                                <MdOutlineRuleFolder className="defaultIcon" />
                                <MdRuleFolder className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.syslogTags.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "syslogTags")}
                            >
                                <HiOutlineViewColumns className="defaultIcon" />
                                <HiViewColumns className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.syslogSignalFilters.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "syslogSignalFilters")}
                            >
                                <RiFilterLine className="defaultIcon" />
                                <RiFilterFill className="hoverIcon" />
                            </button>
                        </>
                    )}
                    {dataSource === "snmptraps" && (
                        <>
                            <button
                                className={`iconButton ${dropdowns.statefulTrapRules.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "statefulTrapRules")}
                            >
                                <MdOutlineRuleFolder className="defaultIcon" />
                                <MdRuleFolder className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.snmpTrapTags.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "snmpTrapTags")}
                            >
                                <HiOutlineViewColumns className="defaultIcon" />
                                <HiViewColumns className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.trapSignalFilters.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "trapSignalFilters")}
                            >
                                <RiFilterLine className="defaultIcon" />
                                <RiFilterFill className="hoverIcon" />
                            </button>
                        </>
                    )}

                    {dataSource === "telemetry" && (
                        <>
                            <button
                                className={`iconButton ${dropdowns.telemetryRules?.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "telemetryRules")}
                            >
                                <MdOutlineRuleFolder className="defaultIcon" />
                                <MdRuleFolder className="hoverIcon" />
                            </button>

                            <button
                                className={`iconButton ${dropdowns.telemetryFilters?.visible ? "active" : ""}`}
                                onClick={(e) => handleButtonClick(e, "telemetryFilters")}
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
                        <ChartView keycloak={keycloak} currentUser={currentUser} source='signals' dataSource={dataSource} selectedTags={columnConfigs[dataSource]} />
                    </div>
                ) : (
                    <div className="syslogsTableContainer">
                        <EventsTable currentUser={currentUser} dataSource={dataSource} data={signalData} columns={columnConfigs[dataSource]} signalSource={dataSource} onDownload={(downloadFn) => (downloadRef.current = downloadFn)} onRowSelectChange={handleRowSelectChange} />
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
                    <StatefulSyslogs keycloak={keycloak} devices={devices} mnemonics={mnemonics} tags={syslogTags} onReload={reloadStatefulSyslogRules} showNotification={showNotification} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.statefulTrapRules.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <StatefulTraps keycloak={keycloak} devices={devices} snmpTrapOids={snmpTrapOids} tags={snmpTrapTags} onReload={reloadStatefulTrapRules} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.syslogSignalFilters.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <SyslogSignalFilters keycloak={keycloak} tags={syslogTags} onSelectedSyslogFiltersChange={handleFiltersChange} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.trapSignalFilters.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <TrapSignalFilters keycloak={keycloak} tags={snmpTrapTags} onSelectedTrapFiltersChange={handleFiltersChange} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.time.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto' }} >
                    <SearchTime startTime={startTime} endTime={endTime} onTimeRangeChange={handleTimeRangeChange} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.syslogTags.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '280px' }}>
                    <SyslogTags dataSource={dataSource} tags={syslogTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.snmpTrapTags.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '280px' }}>
                    <SnmpTrapTags dataSource={dataSource} tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
                </div>
            </div>
        </div>
    );
}

export default Signals;
