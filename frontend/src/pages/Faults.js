import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import { MdBookmarkBorder, MdBookmark } from "react-icons/md";
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";
import ChartView from '../components/misc/ChartView.js';
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import Mnemonics from '../components/syslogs/Mnemonics.js';
import SyslogTags from '../components/syslogs/TagColumns.js';
import SearchTime from '../components/misc/SearchTime.js';
import FilterSyslogs from '../components/syslogs/FilterSyslogs.js';
import FilterTraps from '../components/snmptraps/FilterTraps.js';
import RegExConfig from '../components/syslogs/RegExConfig.js';
import UploadMIB from '../components/snmptraps/UploadMIB.js';
import { PiUploadBold, PiUploadFill } from "react-icons/pi";
import SnmpTrapOid from '../components/snmptraps/SnmpTrapOid.js';
import TrapTags from '../components/snmptraps/TrapTags.js';
import { IoPieChartOutline, IoPieChartSharp, IoRefreshCircleOutline, IoRefreshCircleSharp } from "react-icons/io5";
import { RiInfoCardLine, RiInfoCardFill } from "react-icons/ri";
import { PiArticleMediumLight, PiArticleMediumFill } from "react-icons/pi";
import { useMnemonics } from '../hooks/useMnemonics.js';
import { useSyslogRegEx } from '../hooks/useSyslogRegEx.js';
import { useSnmpTrapOids } from '../hooks/useSnmpTrapOids.js';
import { useDevices } from '../hooks/useDevices.js';
import { useSyslogTags } from '../hooks/useSyslogTags';
import { useSnmpTrapTags } from '../hooks/useSnmpTrapTags';
import { useFaultData } from '../hooks/useFaultData.js';

function Faults({ currentUser, setDashboardTitle, keycloak }) {
    const [startTime, setStartTime] = useState(() => new Date(Date.now() - 60 * 60 * 1000));
    const [endTime, setEndTime] = useState(() => new Date());
    const [filters, setFilters] = useState({});
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData();
    const [selectedTags, setSelectedTags] = useState([]);
    const [dataSource, setDataSource] = useState('syslogs');
    const downloadRef = useRef(null);
    const dropdownWrapperRef = useRef(null);
    const dropdownMenuRef = useRef(null);
    const buttonsContainerRef = useRef(null);

    const [dropdowns, setDropdowns] = useState({
        syslogTags: { visible: false, position: { x: 0, y: 0 } },
        regEx: { visible: false, position: { x: 0, y: 0 } },
        filterSyslogs: { visible: false, position: { x: 0, y: 0 } },
        filterSnmpTraps: { visible: false, position: { x: 0, y: 0 } },
        time: { visible: false, position: { x: 0, y: 0 } },
        tags: { visible: false, position: { x: 0, y: 0 } },
        mnemonics: { visible: false, position: { x: 0, y: 0 } },
        MIBFiles: { visible: false, position: { x: 0, y: 0 } },
        snmpTrapOids: { visible: false, position: { x: 0, y: 0 } },
        trapTags: { visible: false, position: { x: 0, y: 0 } },
        eventStatistics: { visible: false, position: { x: 0, y: 0 } },
    });
    const [selStatisticTags, setSelStatisticTags] = useState([]);
    const [selEventTags, setSelEventTags] = useState([]);
    const [selSignalTags, setSelSignalTags] = useState([]);
    const [page, setPage] = useState(1);
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
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [columnConfigs, setColumnConfigs] = useState(baseColumns);
    const { mnemonics, loading: mnemonicsLoading, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { regExpressions, regExTagNames, loading: regexLoading, reload: reloadRegEx } = useSyslogRegEx(keycloak);
    const { snmpTrapOids, loading: oidsLoading, reload: reloadSnmpTrapOids } = useSnmpTrapOids(keycloak);
    const { tags: syslogTags, loading: syslogTagsLoading, reload: reloadSyslogTags } = useSyslogTags(keycloak, false);
    const { tags: snmpTrapTags, loading: snmpTrapTagsLoading, reload: reloadSnmpTrapTags } = useSnmpTrapTags(keycloak, false);
    const activeTags = dataSource === "syslogs" ? syslogTags : snmpTrapTags;
    const tagsLoading = dataSource === "syslogs" ? syslogTagsLoading : snmpTrapTagsLoading;
    const [tagNames, setTagNames] = useState([]);
    const { devices, loading: devicesLoading, reload: reloadDevices } = useDevices(keycloak);
    const [view, setView] = useState("list")


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
                    label: tag,      // label shown in table header
                    value: tag,      // field key in data
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
    };

    const handleTagsClick = (event) => {
        handleButtonClick(event, 'tags');

        if (dataSource === "syslogs") {
            if (syslogTags.length === 0) {
                reloadSyslogTags();
            }
        }

        if (dataSource === "snmptraps") {
            if (snmpTrapTags.length === 0) {
                reloadSnmpTrapTags();
            }
        }
    };

    useEffect(() => {
        setDashboardTitle("Events Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    const handleRowSelectChange = (newSelectedRows) => {
        console.log('Testing!!!');
    };

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setPage(1);
        ///loadData(keycloak, dataSource, page, startTime?.toISOString(), endTime?.toISOString(), filters);
        setColumnConfigs(baseColumns);

        if (source === 'syslogs') {
            reloadMnemonics(keycloak);
            reloadRegEx(keycloak);
        } else if (source === 'snmptraps') {
            reloadSnmpTrapOids(keycloak);
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
        reloadRegEx(keycloak);
        setDropdowns(prev => ({
            ...prev,
            regExConfig: { ...prev.regExConfig, visible: false }
        }));
    }

    //useEffect(() => {
    //    loadData(keycloak, dataSource, page, startTime?.toISOString(), endTime?.toISOString(), filters);
    //    if (dataSource === 'syslogs') {
    //        reloadMnemonics(keycloak);
    //        reloadRegEx(keycloak);
    //    } else if (dataSource === 'snmptraps') {
    //        reloadSnmpTrapOids(keycloak);
    //    }
    //}, [keycloak, dataSource, page, startTime, endTime, filters]);

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
                    {dataSource === 'syslogs' && (<>
                        <button className={`iconButton ${dropdowns.mnemonics.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'mnemonics')} >
                            <PiArticleMediumLight className="defaultIcon" />
                            <PiArticleMediumFill className="hoverIcon" />
                        </button>
                        <button className={`iconButton ${dropdowns.regEx.visible ? 'active' : ''} `} style={{ marginRight: '20px' }} onClick={(event) => handleButtonClick(event, 'regEx')} >
                            <MdBookmarkBorder className="defaultIcon" />
                            <MdBookmark className="hoverIcon" />
                        </button> </>)}
                    {dataSource === 'snmptraps' && (<>
                        <button className={`iconButton ${dropdowns.MIBFiles.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'MIBFiles')} >
                            <PiUploadBold className="defaultIcon" />
                            <PiUploadFill className="hoverIcon" />
                        </button>
                        <button className={`iconButton ${dropdowns.snmpTrapOids.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'snmpTrapOids')} >
                            <RiInfoCardLine className="defaultIcon" />
                            <RiInfoCardFill className="hoverIcon" />
                        </button>
                        <button className={`iconButton ${dropdowns.regEx.visible ? 'active' : ''} `} style={{ marginRight: '20px' }} onClick={(event) => handleButtonClick(event, 'trapTags')} >
                            <MdBookmarkBorder className="defaultIcon" />
                            <MdBookmark className="hoverIcon" />
                        </button>  </>)}
                    <button className="iconButton" onClick={() => loadData(keycloak, dataSource, page, startTime?.toISOString(), endTime?.toISOString(), filters)} >
                        <IoRefreshCircleOutline className="defaultIcon" />
                        <IoRefreshCircleSharp className="hoverIcon" />
                    </button>
                    <button className={`iconButton ${dropdowns.tags.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'tags')} >
                        <HiOutlineViewColumns className={`defaultIcon ${selectedTags.length > 0 ? 'hasFilters' : 'noFilters'} `} />
                        <HiViewColumns className="hoverIcon" />
                    </button>
                    {dataSource === 'syslogs' && (<>
                        <button className={`iconButton ${dropdowns.filterSyslogs.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'filterSyslogs')} >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill className="hoverIcon" />
                        </button> 
                    </>)}
                    {dataSource === 'snmptraps' && (<>
                        <button className={`iconButton ${dropdowns.filterSnmpTraps.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'filterSnmpTraps')} >
                            <RiFilterLine className="defaultIcon" />
                            <RiFilterFill className="hoverIcon" />
                        </button> 
                    </>)} 
                    <button className={`iconButton ${dropdowns.time.visible ? 'active' : ''} `} onClick={(event) => handleButtonClick(event, 'time')} >
                        <FaRegClock className="defaultIcon hasFilters" />
                        <FaClock className="hoverIcon" />
                    </button>
                    <button className="iconButton" >
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
                        <ChartView keycloak={keycloak} currentUser={currentUser} source='events' dataSource={dataSource} selectedTags={columnConfigs[dataSource]} />
                    </div>) : (
                    <div className="syslogsTableContainer">
                        <EventsTable dataSource={dataSource} data={eventsData} totalPages={totalPages} columns={columnConfigs[dataSource]} signalSource={dataSource} onRowSelectChange={handleRowSelectChange} page={page} onPageChange={setPage} />
                    </div>))}
            </div>
            <div ref={dropdownMenuRef}>
                <div
                    className={`dropdownMenu ${dropdowns.filterSyslogs.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <FilterSyslogs source={dataSource} tags={tagNames} devices={devices} onSelectedTagsChange={handleSyslogTagsChange} onSelectedTagsSearch={handleSearchAndCloseDropdown} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.filterSnmpTraps.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '420px' }} >
                    <FilterTraps source={dataSource} tags={tagNames} devices={devices} mnemonics={mnemonics} onSelectedTagsChange={handleSyslogTagsChange} onSelectedTagsSearch={handleSearchAndCloseDropdown} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.regEx.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '700px' }} >
                    <RegExConfig devices={devices} tags={tagNames} regExpressions={regExpressions} onAdd={handleTagsEditing} onUpdate={handleTagsEditing} onDelete={handleTagsEditing} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.time.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto' }} >
                    <SearchTime startTime={startTime} endTime={endTime} onTimeRangeChange={handleTimeRangeChange} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.tags.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: '280px' }}>
                    <SyslogTags dataSource={dataSource} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.MIBFiles.visible ? 'dropdownVisible' : 'dropdownHidden'} `}>
                    <UploadMIB keycloak={keycloak} currentUser={currentUser} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.snmpTrapOids.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <SnmpTrapOid currentUser={currentUser} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.trapTags.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <TrapTags currentUser={currentUser} />
                </div>
                <div
                    className={`dropdownMenu ${dropdowns.mnemonics.visible ? 'dropdownVisible' : 'dropdownHidden'} `}
                    style={{ width: 'auto', maxHeight: '740px', overflow: 'hidden' }}>
                    <Mnemonics keycloak={keycloak} currentUser={currentUser} mnemonics={mnemonics} entityOptions={regExpressions} />
                </div>
            </div>
        </div>
    );
}

export default Faults;
