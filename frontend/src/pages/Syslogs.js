import React, { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import { BsArrowLeftCircle, BsArrowRightCircle } from "react-icons/bs";
import { FaClock, FaRegClock } from "react-icons/fa";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import SyslogTags from '../components/syslogs/TagColumns.js';
import FilterSyslogs from '../components/syslogs/FilterSyslogs.js';
import RegExConfig from '../components/syslogs/RegExConfig.js';
import Mnemonics from '../components/syslogs/Mnemonics.js';
import SearchTime from '../components/misc/SearchTime.js';
import InjectSyslogs from '../components/syslogs/InjectSyslogs.js';
import { IoMdRefresh, IoMdRefreshCircle } from "react-icons/io";
import ReceiverConfig from '../components/syslogs/ReceiverConfig.js';
import apiClient from '../components/misc/AxiosConfig.js';
import { BiInjection, BiSolidInjection } from "react-icons/bi";
import { MdBookmarkBorder, MdBookmark } from "react-icons/md";

function Syslogs({ currentUser }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [dropdowns, setDropdowns] = useState({
        syslogTagsConfig: { visible: false, position: { x: 0, y: 0 } },
        regExConfig: { visible: false, position: { x: 0, y: 0 } },
        searchSyslogs: { visible: false, position: { x: 0, y: 0 } },
        timerangeFilters: { visible: false, position: { x: 0, y: 0 } },
        showSyslogTags: { visible: false, position: { x: 0, y: 0 } },
        injectSyslog: { visible: false, position: { x: 0, y: 0 } },
        mnemonics: { visible: false, position: { x: 0, y: 0 } },
    });
    const [initialColumns, setInitialColumns] = useState([
        'timestamp',
        'lsn',
        'device',
        'mnemonic',
        'message',
    ]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [syslogs, setSyslogs] = useState([]);
    const [tags, setTags] = useState([]);
    const [mnemonics, setMnemonics] = useState([]);
    const [hostnames, setHostnames] = useState([]);
    const [devices, setDevices] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [deleteAlert, setDeleteAlert] = useState(false);
    const [tagToEdit, setTagToEdit] = useState(null);
    const [editAlert, setEditAlert] = useState(false);
    const [syslogsPerPage, setSyslogsPerPage] = useState(() => {
        const savedEntries = localStorage.getItem('entriesPerPage');
        return savedEntries ? JSON.parse(savedEntries) : 10;
    });
    const [filterParams, setFilterParams] = useState([]);
    const [totalEntries, setTotalEntries] = useState(false);
    const [selectedTagFilters, setSelectedTagFilters] = useState([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState({
        startDate: new Date(new Date().getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        endDate: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000))
    });
    const [isCustomRangeVisible, setIsCustomRangeVisible] = useState(true);
    const [downloadData, setDownloadData] = useState(false);
    const downloadRef = useRef(null);
    const [reloadActive, setReloadActive] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [getMnemonics, setGetMnemonics] = useState(false);
    const [getTags, setGetTags] = useState(false);
    const [getDevices, setGetDevices] = useState(false);
    const [tagNames, setTagNames] = useState([]);
    const [getRegEx, setGetRegEx] = useState(false);
    const [regExpressions, setRegExpressions] = useState([]);

    const handleDownloadClick = () => {
        if (downloadRef.current) {
            downloadRef.current();
        }
    };

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
        if (dropdownKey === 'searchSyslogs' && newVisibility) {
            setGetMnemonics(true);
            setGetTags(true);
            setGetDevices(true);
        }
        if (dropdownKey === 'mnemonics' && newVisibility) {
            setGetMnemonics(true);
            setGetTags(true);
            setGetRegEx(true);
        }
        if (dropdownKey === 'injectSyslog' && newVisibility) {
            setGetDevices(true);
        }
        if (dropdownKey === 'regExConfig' && newVisibility) {
            setGetRegEx(true);
        }
    };

    useEffect(() => {
        console.log('Current User:', currentUser);
        localStorage.setItem('entriesPerPage', JSON.stringify(syslogsPerPage));
    }, [syslogsPerPage]);


    useEffect(() => {
        if (getMnemonics) {
            fetchMnemonics();
        }
        if (getDevices) {
            fetchAgents();
        }
        if (getTags) {
            fetchTags();
        }
        if (getRegEx) {
            fetchRegEx();
        }
    }, [getMnemonics, getDevices, getTags, getRegEx]);

    useEffect(() => {
        loadSyslogs();
    }, [currentPage, syslogsPerPage, filterParams, selectedTimeRange]);

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

    const fetchTags = async () => {
        try {
            const response = await apiClient.get('/syslogs/tags/');
            const tagsObject = response.data.map((tag) => ({
                id: tag.id,
                label: tag.name,
                name: tag.name,
            }));
            const tagNames = response.data.map((tag) => tag.name);
            setTags(tagsObject);
            setTagNames(tagNames);
            console.log('List of Tag Names:', tagNames);
        } catch (error) {
            console.error('Error fetching tag names:', error);
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

    const loadSyslogs = (filters = {}) => {
        setSyslogs(null);
        setLoading(true);

        const params = new URLSearchParams({
            page: currentPage,
            perPage: syslogsPerPage,
            startTime: formatDateForUrl(selectedTimeRange.startDate),
            endTime: formatDateForUrl(selectedTimeRange.endDate),
        });

        if (filters.agent && filters.agent.length > 0) {
            filters.agent.forEach(agent => params.append('agent', agent));
        }
        if (filters.hostname && filters.hostname.length > 0) {
            filters.hostname.forEach(hostname => params.append('hostname', hostname));
        }
        if (filters.tag && filters.tag.length > 0) {
            filters.tag.forEach(tag => params.append('tag', tag));
        }
        if (filters.mnemonic && filters.mnemonic.length > 0) {
            filters.mnemonic.forEach(mnemonic => params.append('mnemonic', mnemonic));
        }

        if (filters.tags) {
            Object.entries(filters.tags).forEach(([tagName, tagValues]) => {
                tagValues.forEach(tag => {
                    params.append(`tags__${tagName}`, tag);
                });
            });
        }

        apiClient
            .get(`/syslogs/`)
            .then(response => {
                let results = [];
                if (response.data && response.data.results) {
                    results = response.data.results.map(item => item._source || item); // Fallback if no _source
                } else if (response.data && Array.isArray(response.data)) {
                    // Handle the case where the entire response.data is an array of hits
                    results = response.data.map(item => item._source || item);
                } else {
                    console.warn('Unexpected response data structure:', response.data);
                }
                console.log('Syslogs (normalized):', results);
                setSyslogs(results);
                setTotalEntries(response.data ? response.data.count : 0); // Handle potential absence of count
            })
            .catch(error => {
                console.error('Error fetching syslogs:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    };


    const formatDateForUrl = (date) => {
        const isoString = new Date(date).toISOString();
        return isoString;
    };

    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleTimeRangeChange = (startDate, endDate) => {
        setSelectedTimeRange({ startDate, endDate });

        setDropdowns((prevDropdowns) => ({
            ...prevDropdowns,
            timerangeFilters: { ...prevDropdowns.timerangeFilters, visible: false },
        }));
    };

    const handleTimeRangeSelect = (range) => {
        console.log('Selected timerange:', range)
        setSyslogs(null);
        setLoading(true);

        apiClient
            .get(`/syslogs/?${range}`)
            .then(response => {
                console.log('Syslogs:', response.data.results);
                setSyslogs(response.data.results);
                setTotalEntries(response.data.count);
            })
            .catch(error => {
                console.error('Error fetching syslogs:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    const applyTimeRangeFilter = (startDate, endDate, isCustomRange) => {
        setSelectedTimeRange({ startDate, endDate });
        setIsCustomRangeVisible(isCustomRange);
        const newFilterParams = {
            ...filterParams,
            startDate: startDate ? startDate.toISOString() : null,
            endDate: endDate ? endDate.toISOString() : null,
        };
        setFilterParams(newFilterParams);
    };

    const handleSyslogsPerPageChange = (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) {
            setSyslogsPerPage(value);
            setCurrentPage(1);
        }
    };

    const totalPages = Math.ceil(totalEntries / syslogsPerPage);

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            console.log('Print current page: ', currentPage)
        }
    };

    const handleTagCheckboxChange = (tagName) => {
        setInitialColumns((prevColumns) => {
            if (prevColumns.includes(tagName)) {
                return prevColumns.filter((column) => column !== tagName);
            } else {
                return [...prevColumns, tagName];
            }
        });
    };

    const handleSyslogTagsChange = (selectedTags) => {
        setSelectedTagFilters(selectedTags);
    };


    console.log('Mnemonics and Hostnames in Syslog Database:', mnemonics, hostnames)

    const isFilterActive = Boolean(
        selectedTagFilters.length > 0 ||
        selectedTagFilters.agentHostnames?.length ||
        selectedTagFilters.agent?.length ||
        selectedTagFilters.hostname?.length ||
        selectedTagFilters.tag?.length ||
        selectedTagFilters.mnemonic?.length ||
        Object.keys(selectedTagFilters.tags || {}).length > 0
    );

    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    const handleSearchAndCloseDropdown = (selectedTags) => {
        loadSyslogs(selectedTags);
        setDropdowns((prevState) => ({
            ...prevState,
            searchSyslogs: {
                ...prevState.searchSyslogs,
                visible: false,
            },
        }));
    };

    return (
        <div className="mainContainer">
            <div className="mainContainerHeader">
                <h2 className="mainContainerTitle">Syslog Database</h2>
                <div className="mainContainerButtons">
                    <div className="headerButtons">
                        {currentUser.is_staff && (
                            <>
                                <button
                                    className={`iconButton ${dropdowns.syslogTagsConfig.visible ? 'active' : ''}`}
                                    onClick={(event) => handleButtonClick(event, 'syslogTagsConfig')}
                                >
                                    <IoSettingsOutline className="defaultIcon" />
                                    <IoSettingsSharp className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${dropdowns.mnemonics.visible ? 'active' : ''}`}
                                    onClick={(event) => handleButtonClick(event, 'mnemonics')}
                                >
                                    <MdBookmarkBorder className="defaultIcon" />
                                    <MdBookmark className="hoverIcon" />
                                </button>

                            </>
                        )}
                        <button
                            className={`iconButton ${dropdowns.regExConfig.visible ? 'active' : ''}`}
                            style={{ marginRight: '20px' }}
                            onClick={(event) => handleButtonClick(event, 'regExConfig')}
                        >
                            <RiAddCircleLine className="defaultIcon" />
                            <RiAddCircleFill className="hoverIcon" />
                        </button>
                        <button
                            className={`iconButton ${dropdowns.injectSyslog.visible ? 'active' : ''}`}
                            onClick={(event) => handleButtonClick(event, 'injectSyslog')}
                        >
                            <BiInjection className="defaultIcon" />
                            <BiSolidInjection className="hoverIcon" />
                        </button>
                        <button
                            className="iconButton"
                            onClick={() => setReloadActive(!reloadActive)}
                        >
                            <IoMdRefresh className="defaultIcon" />
                            <IoMdRefreshCircle className="hoverIcon" />
                        </button>
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
                            <RiFilterLine className={`defaultIcon ${Object.values(selectedTagFilters).some((filterArray) => filterArray.length > 0)
                                ? 'hasFilters'
                                : 'noFilters'
                                }`} />
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
                            onClick={handleDownloadClick}
                            disabled={selectedRows.length === 0}
                        >
                            <RiDownloadCloudLine className="defaultIcon" />
                            <RiDownloadCloudFill className="hoverIcon" />
                        </button>

                    </div>
                </div>
            </div>

            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <div className="syslogsTableContainer">
                        <EventsTable
                            currentUser={currentUser}
                            data={syslogs}
                            columns={initialColumns}
                            signalSource="Syslogs"
                            onDownload={(downloadFn) => (downloadRef.current = downloadFn)}
                            onRowSelectChange={handleRowSelectChange}
                        />
                    </div>
                )}
                <div className="paginationContainer">
                    <div onClick={prevPage} style={{ cursor: 'pointer', marginLeft: '10px' }} disabled={currentPage === 1 || loading}>
                        <BsArrowLeftCircle /> Previous
                    </div>
                    <div>
                        <label htmlFor="syslogsPerPage">Syslogs Per Page:</label>
                        <input
                            type="number"
                            id="syslogsPerPage"
                            value={syslogsPerPage}
                            onChange={handleSyslogsPerPageChange}
                            min="1"
                        />
                    </div>
                    <div>
                        Page {currentPage} of {totalPages} | Total Entries: {totalEntries}
                    </div>
                    <div onClick={nextPage} style={{ cursor: 'pointer', marginRight: '10px', }} disabled={currentPage === totalPages || loading}>
                        Next <BsArrowRightCircle />
                    </div>
                </div>
            </div>
            <div
                className={`dropdownMenu ${dropdowns.injectSyslog.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '500px' }}
            >
                <InjectSyslogs devices={devices} />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.syslogTagsConfig.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '640px' }}
            ><ReceiverConfig />

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
                    onDelete={(tag) => {
                        setTagToDelete(tag);
                        setDeleteAlert(true);
                    }}
                    onEdit={(tag) => {
                        setTagToEdit({ tag });
                        setEditAlert(true);
                    }}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.searchSyslogs.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '460px' }}
            >
                <FilterSyslogs
                    tags={tagNames}
                    devices={devices}
                    mnemonics={mnemonics}
                    onSelectedTagsChange={handleSyslogTagsChange}
                    onSelectedTagsSearch={handleSearchAndCloseDropdown}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.timerangeFilters.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '460px' }}
            >
                <SearchTime
                    onTimeRangeSelect={handleTimeRangeSelect}
                    onTimeRangeChange={handleTimeRangeChange}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.showSyslogTags.visible ? 'dropdownVisible' : 'dropdownHidden'}`}>
                <SyslogTags
                    tags={tagNames}
                    selectedTags={selectedTags}
                    handleTagCheckboxChange={handleTagCheckboxChange}
                />
            </div>

            <div
                className={`dropdownMenu ${dropdowns.mnemonics.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: 'auto',
                    maxHeight: '740px',
                    overflow: 'hidden',
                    marginRight: '70px',
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

export default Syslogs;