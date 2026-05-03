import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import ChartView from '../components/misc/ChartView.js';

import { MdBookmarkBorder, MdBookmark } from "react-icons/md";
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";
import { IoPieChartOutline, IoPieChartSharp, IoRefreshCircleOutline, IoRefreshCircleSharp } from "react-icons/io5";
import { RiInfoCardLine, RiInfoCardFill } from "react-icons/ri";
import { PiArticleMediumLight, PiArticleMediumFill } from "react-icons/pi";
import { PiUploadBold, PiUploadFill } from "react-icons/pi";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";

import Mnemonics from '../components/syslogs/Mnemonics.js';
import SyslogTags from '../components/syslogs/Tags.js';
import SearchTime from '../components/misc/SearchTime.js';
import FilterSyslogs from '../components/syslogs/FilterSyslogs.js';
import FilterTraps from '../components/snmptraps/FilterTraps.js';
import RegEx from '../components/syslogs/RegEx.js';
import UploadMIB from '../components/snmptraps/UploadMIB.js';
import SnmpTrapOid from '../components/snmptraps/SnmpTrapOid.js';
import SnmpTrapTags from '../components/snmptraps/SnmpTrapTags.js';
import SnmpTrapTagConfig from '../components/snmptraps/SnmpTrapTagConfig.js';
import Statistics from '../components/misc/Statistics.js';

import { useMnemonics } from '../hooks/useMnemonics.js';
import { useSyslogRegEx } from '../hooks/useSyslogRegEx.js';
import { useSnmpTrapOids } from '../hooks/useSnmpTrapOids.js';
import { useDevices } from '../hooks/useDevices.js';
import { useSyslogTags } from '../hooks/useSyslogTags';
import { useSnmpTrapTags } from '../hooks/useSnmpTrapTags';
import { useFaultData } from '../hooks/useFaultData.js';
import { downloadTableData } from '../components/misc/DownloadData.js';

function Faults({ currentUser, setDashboardTitle, showNotification, keycloak }) {
    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [filters, setFilters] = useState({});
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData();
    const [selectedTags, setSelectedTags] = useState([]);
    const [dataSource, setDataSource] = useState('syslogs');
    const dropdownWrapperRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [dropdowns, setDropdowns] = useState({
        time: { visible: false, position: { x: 0, y: 0 } },
        tags: { visible: false, position: { x: 0, y: 0 } },
        syslogTags: { visible: false, position: { x: 0, y: 0 } },
        syslogFilters: { visible: false, position: { x: 0, y: 0 } },
        syslogMnemonics: { visible: false, position: { x: 0, y: 0 } },
        syslogRegExes: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapTags: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapFilters: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapMibFiles: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapOids: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapTagConfig: { visible: false, position: { x: 0, y: 0 } },
        eventStatistics: { visible: false, position: { x: 0, y: 0 } },
    });
    const [page, setPage] = useState(1);
    const [tags, setTags] = useState([]);
    const baseColumns = {
        syslogs: [
            { label: 'Timestamp', value: 'timestamp' },
            { label: 'Device', value: 'device' },
            { label: 'Severity', value: 'severity' },
            { label: 'Mnemonic', value: 'mnemonic' },
            { label: 'Message', value: 'message' },
        ],
        snmptraps: [
            { label: 'Timestamp', value: 'timestamp' },
            { label: 'Device', value: 'device' },
            { label: 'SysUpTime', value: 'sysUpTime' },
            { label: 'Trap OID', value: 'snmpTrapOid' },
            { label: 'Content', value: 'content' },
        ],
    };
    const [columnConfigs, setColumnConfigs] = useState(baseColumns);
    const { mnemonics, loading: mnemonicsLoading, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { list: regularExpressions, loadingList, errorList, loadList: reloadRegEx } = useSyslogRegEx(keycloak);
    const { list: snmpTrapOids, loading: oidsLoading, loadList: reloadSnmpTrapOids } = useSnmpTrapOids(keycloak);
    const { tags: syslogTags, loading: syslogTagsLoading, reload: reloadSyslogTags } = useSyslogTags(keycloak, false);
    const { list: snmpTrapTags, loading: snmpTrapTagsLoading, loadList: reloadSnmpTrapTags } = useSnmpTrapTags(keycloak, false);
    const { devices, loading: devicesLoading, reload: reloadDevices } = useDevices(keycloak);
    const [view, setView] = useState("list")

    const buildTags = (dataSource) => {
        if (dataSource === 'syslogs') {
            const staticTags = [ 
                { label: 'Timestamp', value: 'timestamp' },
                { label: 'Severity', value: 'severity' },
                { label: 'Device', value: 'device' },
                { label: 'Mnemonic', value: 'mnemonic' },
                { label: 'Message', value: 'message' },
            ];

            const dynamicTags = (syslogTags || []).map(tag => ({
                label: tag.label,    
                value: tag.value
            }));

            return [...staticTags, ...dynamicTags];
        }

        if (dataSource === 'snmptraps') {
            const staticTags = [
                { label: 'Timestamp', value: 'timestamp' },
                { label: 'SysUpTime', value: 'sysUpTime' },
                { label: 'SNMP Trap OID', value: 'snmpTrapOid' },
                { label: 'Device', value: 'device' },
                { label: 'Content', value: 'content' }
            ];

            const dynamicTags = (snmpTrapTags || []).map(tag => ({
                label: tag.label,
                value: tag.value
            }));

            return [...staticTags, ...dynamicTags];
        }

        return [];
    };

    useEffect(() => {
        const newTags = buildTags(dataSource);
        setTags(newTags);
    }, [dataSource, syslogTags, snmpTrapTags]);

    const loadSyslogTags = () => {
        if (syslogTags.length === 0) reloadSyslogTags(keycloak);
        console.log('Syslog tags loaded:', syslogTags);
    };

    const loadSyslogRegExes = () => {
        if (regularExpressions.length === 0) reloadRegEx();
    };

    const loadSyslogFilters = () => {
        if (regularExpressions.length === 0) reloadRegEx();
        if (devices.length === 0) reloadDevices(keycloak);
        if (mnemonics.length === 0) reloadMnemonics(keycloak);
    };

    const loadSnmpTrapFilters = () => {
        if (snmpTrapOids.length === 0) reloadSnmpTrapOids(keycloak);
        if (devices.length === 0) reloadDevices(keycloak);
        if (snmpTrapTags.length === 0) reloadSnmpTrapTags(keycloak);
    };

    const loadSyslogMnemonics = () => {
        if (mnemonics.length === 0) reloadMnemonics(keycloak);
        if (regularExpressions.length === 0) reloadRegEx();
    };

    const loadSnmpTrapMibFiles = () => {
        if (syslogTags.length === 0) reloadSyslogTags(keycloak);
    };

    const loadSnmpTrapOids = () => {
        if (devices.length === 0) reloadDevices(keycloak);
        if (snmpTrapOids.length === 0) reloadSnmpTrapOids(keycloak);
        if (snmpTrapTags.length === 0) reloadSnmpTrapTags(keycloak);
    };

    const loadSnmpTrapTags = () => {
        if (snmpTrapTags.length === 0) reloadSnmpTrapTags(keycloak);
    };

    const loadSnmpTrapTagConfig = () => {
        if (snmpTrapTags.length === 0) reloadSnmpTrapTags(keycloak);
        if (snmpTrapOids.length === 0) reloadSnmpTrapOids(keycloak);
    };

    useEffect(() => {
        loadData(
            keycloak,
            dataSource,
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            filters
        );
        if (dataSource === 'syslogs') {
            reloadMnemonics(keycloak);
            reloadRegEx();
            reloadSyslogTags(keycloak);
        } else if (dataSource === 'snmptraps') {
            reloadSnmpTrapOids(keycloak);
            reloadSnmpTrapTags(keycloak);
        }
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

        if (!newVisibility) return;

        switch (dropdownKey) {
            case "syslogTags":
                loadSyslogTags();
                break;

            case "syslogRegExes":
                loadSyslogRegExes();
                break;

            case "syslogFilters":
                loadSyslogFilters();
                break;

            case "snmpTrapFilters":
                loadSnmpTrapFilters();
                break;

            case "syslogMnemonics":
                loadSyslogMnemonics();
                break;

            case "snmpTrapMibFiles":
                loadSnmpTrapMibFiles();
                break;

            case "snmpTrapOids":
                loadSnmpTrapOids();
                break;

            case "snmpTrapTags":
                loadSnmpTrapTags();
                break;

            case "snmpTrapTagConfig":
                loadSnmpTrapTagConfig();
                break;

            default:
                break;
        }
    };

    useEffect(() => {
        setDashboardTitle("Events Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    useEffect(() => {
        console.log('Filtering for:', filters);
    }, []);

    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setPage(1);
        setColumnConfigs(baseColumns[source]);
        setSelectedTags([]);
        setTags([]);

        if (source === 'syslogs') {
            if (!mnemonics?.length) reloadMnemonics(keycloak);
            if (!regularExpressions?.length) reloadRegEx();
            if (!syslogTags?.length) reloadSyslogTags(keycloak);
        } else if (source === 'snmptraps') {
            if (!snmpTrapOids?.length) reloadSnmpTrapOids(keycloak);
            if (!snmpTrapTags?.length) reloadSnmpTrapTags(keycloak);
        }
    };

    const handleTimeRangeChange = (start, end) => {
        setStartTime(start);
        setEndTime(end);
    };


    const handleSearchAndCloseDropdown = (filters) => {
        console.log('Selected tags:', filters);

        setDropdowns(prev => ({
            ...prev,
            searchSyslogs: { ...prev.searchSyslogs, visible: false }
        }));

        ///loadData(keycloak, dataSource, page, startTime?.toISOString(), endTime?.toISOString(), filters);
    };

    const handleTagsEditing = () => {
        reloadRegEx();
        setDropdowns(prev => ({ ...prev, regEx: { ...prev.regEx, visible: false } }));
    }

    const handleSyslogTagsChange = (selectedTags) => {
        console.log('Selected tags:', selectedTags)
    };

    const handleFiltersChange = (newFilters) => {
        console.log("Filtering for:", newFilters);
        setFilters(newFilters);
        setPage(1);
        loadData(keycloak, "syslogs", 1, startTime, endTime, newFilters);
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

    useEffect(() => {
        setView("list");
    }, []);

    const toggleView = () => {
        setView(prev => (prev === "list" ? "chart" : "list"));
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
                        <button className="iconButton" style={{ marginRight: '20px' }} onClick={toggleView} >
                            <TfiLayoutListThumb className="defaultIcon" />
                            <IoPieChartSharp className="hoverIcon" />
                        </button> </>) : (<>
                            <button className="iconButton" style={{ marginRight: '20px' }} onClick={toggleView} >
                                <IoPieChartOutline className="defaultIcon" />
                                <TfiLayoutListThumbAlt className="hoverIcon" />
                            </button> </>)}
                    {dataSource === 'syslogs' && (<>
                        <button className={`iconButton ${dropdowns.syslogMnemonics.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'syslogMnemonics')} >
                            <PiArticleMediumLight className="defaultIcon" />
                            <PiArticleMediumFill className="hoverIcon" />
                        </button>
                        <button className={`iconButton ${dropdowns.syslogRegExes.visible ? 'active' : ''} `} style={{ marginRight: '20px' }} onClick={(event) => handleButtonClick(event, 'syslogRegExes')} >
                            <MdBookmarkBorder className="defaultIcon" />
                            <MdBookmark className="hoverIcon" />
                        </button> </>)}
                    {dataSource === 'snmptraps' && (<>
                        <button className={`iconButton ${dropdowns.snmpTrapMibFiles.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'snmpTrapMibFiles')} >
                            <PiUploadBold className="defaultIcon" />
                            <PiUploadFill className="hoverIcon" />
                        </button>
                        <button className={`iconButton ${dropdowns.snmpTrapOids.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'snmpTrapOids')} >
                            <RiInfoCardLine className="defaultIcon" />
                            <RiInfoCardFill className="hoverIcon" />
                        </button>
                        <button className={`iconButton ${dropdowns.snmpTrapTagConfig.visible ? 'active' : ''} `} style={{ marginRight: '20px' }} onClick={(event) => handleButtonClick(event, 'snmpTrapTagConfig')} >
                            <MdBookmarkBorder className="defaultIcon" />
                            <MdBookmark className="hoverIcon" />
                        </button>  </>)}
                    <button className="iconButton" onClick={() => loadData(keycloak, dataSource, page, startTime?.toISOString(), endTime?.toISOString(), filters)} >
                        <IoRefreshCircleOutline className="defaultIcon" />
                        <IoRefreshCircleSharp className="hoverIcon" />
                    </button>
                    {dataSource === "syslogs" ? (<>
                        <button className={`iconButton ${dropdowns.syslogTags.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'syslogTags')} >
                            <HiOutlineViewColumns className="defaultIcon" />
                            <HiViewColumns className="hoverIcon" />
                        </button> </>) : (<>
                            <button className={`iconButton ${dropdowns.snmpTrapTags.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'snmpTrapTags')} >
                                <HiOutlineViewColumns className="defaultIcon" />
                                <HiViewColumns className="hoverIcon" />
                            </button> </>)}
                    {dataSource === 'syslogs' && (<>
                        <button className={`iconButton ${dropdowns.syslogFilters.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'syslogFilters')} >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill className="hoverIcon" />
                        </button>
                    </>)}
                    {dataSource === 'snmptraps' && (<>
                        <button className={`iconButton ${dropdowns.snmpTrapFilters.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'snmpTrapFilters')} >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill className="hoverIcon" />
                        </button>
                    </>)}
                    <button className={`iconButton ${dropdowns.time.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'time')} >
                        <FaRegClock className="defaultIcon hasFilters" />
                        <FaClock className="hoverIcon" />
                    </button>
                    <button
                        className="iconButton"
                        onClick={() => downloadTableData({ data: eventsData, selectedRows, columns: columnConfigs[dataSource], fileName: `${dataSource}_events.csv` })}>
                        <RiDownloadCloudLine className="defaultIcon" />
                        <RiDownloadCloudFill className="hoverIcon" />
                    </button>
                </div>
            </div>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <>
                        {view === 'list' && (
                            <div className="syslogsTableContainer">
                                <EventsTable dataSource={dataSource} data={eventsData} totalPages={totalPages} tags={tags} signalSource={dataSource} onRowSelectChange={handleRowSelectChange} page={page} onPageChange={setPage} />
                            </div>
                        )}
                        {view === 'chart' && (
                            <div className="syslogsTableContainer">
                                <Statistics keycloak={keycloak} source="events" dataSource={dataSource} selectedTags={columnConfigs[dataSource]} tags={tags} />
                            </div>
                        )}
                    </>
                )}
            </div>
            <div ref={dropdownMenuRef}>
                <div
                    className={`dropdownMenu ${dropdowns.syslogFilters.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <FilterSyslogs keycloak={keycloak} source={dataSource} tags={syslogTags} onSelectedSyslogFiltersChange={handleFiltersChange} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.snmpTrapFilters.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <FilterTraps source={dataSource} tags={snmpTrapTags} devices={devices} mnemonics={mnemonics} onSelectedTagsChange={handleSyslogTagsChange} onSelectedTagsSearch={handleSearchAndCloseDropdown} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.syslogRegExes.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '700px' }} >
                    <RegEx keycloak={keycloak} devices={devices} tags={syslogTags} regularExpressions={regularExpressions} showNotification={showNotification} onReload={reloadRegEx} />
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
                <div
                    className={`dropdownMenu ${dropdowns.snmpTrapMibFiles.visible ? 'dropdownVisible' : 'dropdownHidden'} `}>
                    <UploadMIB keycloak={keycloak} currentUser={currentUser} showNotification={showNotification} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.snmpTrapOids.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <SnmpTrapOid keycloak={keycloak} snmpTrapOids={snmpTrapOids} snmpTrapTags={snmpTrapTags} showNotification={showNotification} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.snmpTrapTagConfig.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <SnmpTrapTagConfig keycloak={keycloak} snmpTrapTags={snmpTrapTags} currentUser={currentUser} onReload={reloadSnmpTrapTags} showNotification={showNotification} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.syslogMnemonics.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <Mnemonics keycloak={keycloak} mnemonics={mnemonics} regularExpressions={regularExpressions} showNotification={showNotification} />
                </div>
            </div>
        </div>
    );
}

export default Faults;
