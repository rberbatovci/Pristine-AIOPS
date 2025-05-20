import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import '../css/SyslogDatabase.css';
import { HiOutlineLockClosed } from "react-icons/hi";
import { HiOutlineCog } from "react-icons/hi"; // Example for another button
import EventsTable from '../components/misc/EventsTable.js';
import { BsArrowLeftCircle, BsArrowRightCircle } from "react-icons/bs";
import { FaClock, FaRegClock } from "react-icons/fa";
import { AiOutlineClockCircle } from "react-icons/ai";
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { RiDownloadCloudLine, RiDownloadCloudFill } from "react-icons/ri";
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import TagColumns from '../components/snmptraps/TagColumns.js';
import FilterTraps from '../components/snmptraps/FilterTraps.js';
import OIDConfig from '../components/snmptraps/OIDConfig.js';
import TagsConfig from '../components/snmptraps/TagsConfig.js';
import TrapOIDConfig from '../components/snmptraps/TrapOIDConfig.js';
import ReceiverConfig from '../components/snmptraps/ReceiverConfig.js';
import SearchTime from '../components/misc/SearchTime.js';
import InjectTraps from '../components/snmptraps/InjectTraps.js';
import { IoShieldCheckmarkSharp, IoShieldCheckmarkOutline } from "react-icons/io5";
import UsersConfig from '../components/snmptraps/UsersConfig.js';
import { IoMdRefresh, IoMdRefreshCircle } from "react-icons/io";
import apiClient from '../components/misc/AxiosConfig.js';
import { BiInjection, BiSolidInjection } from "react-icons/bi";
import { MdBookmarkBorder, MdBookmark } from "react-icons/md";

function SNMPTraps({ currentUser }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [dropdowns, setDropdowns] = useState({
        injectSNMPTrap: { visible: false, position: { x: 0, y: 0 } },
        configureReceiver: { visible: false, position: { x: 0, y: 0 } },
        configureSNMPAuth: { visible: false, position: { x: 0, y: 0 } },
        configureSNMPTrapOids: { visible: false, position: { x: 0, y: 0 } },
        configureSNMPOids: { visible: false, position: { x: 0, y: 0 } },
        showSNMPOids: { visible: false, position: { x: 0, y: 0 } },
        filterSNMPTraps: { visible: false, position: { x: 0, y: 0 } },
        filterTime: { visible: false, position: { x: 0, y: 0 } },
        trapTags: { visible: false, position: { x: 0, y: 0 } },
    });
    const [initialColumns, setInitialColumns] = useState([
        'timestamp',
        'device',
        'snmpTrapOid',
        'content',
    ]);
    const [selectedOids, setSelectedOids] = useState([]);
    const [snmptraps, setSnmpTraps] = useState([]);
    const [oids, setOids] = useState({});
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [devices, setDevices] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [tagToDelete, setTagToDelete] = useState(null);
    const [deleteAlert, setDeleteAlert] = useState(false);
    const [tagToEdit, setTagToEdit] = useState(null);
    const [editAlert, setEditAlert] = useState(false);
    const [trapTags, setTrapTags] = useState([]);
    const [snmpTrapsPerPage, setSnmpTrapsPerPage] = useState(() => {
        const savedEntries = localStorage.getItem('entriesPerPage');
        return savedEntries ? JSON.parse(savedEntries) : 10;
    });
    const [filterParams, setFilterParams] = useState([]);
    const [filterValues, setFilterValues] = useState({});
    const [totalEntries, setTotalEntries] = useState(false);
    const [selectedTagFilters, setSelectedTagFilters] = useState([]);
    const [snmpUsers, setSnmpUsers] = useState([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState({
        startDate: new Date(new Date().getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        endDate: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000))
    });
    const [isCustomRangeVisible, setIsCustomRangeVisible] = useState(true);
    const [selectedRows, setSelectedRows] = useState([]);
    const [tags, setTags] = useState({});
    const [tagNames, setTagNames] = useState([]);

    const handleButtonClick = (event, dropdownKey) => {
        const updatedDropdowns = Object.keys(dropdowns).reduce((acc, key) => {
            acc[key] = { ...dropdowns[key], visible: false };
            return acc;
        }, {});

        setDropdowns({
            ...updatedDropdowns,
            [dropdownKey]: {
                ...dropdowns[dropdownKey],
                visible: !dropdowns[dropdownKey].visible,
            },
        });
    };

    const downloadRef = useRef(null);

    const handleDownloadClick = () => {
        if (downloadRef.current) {
            downloadRef.current();
        }
    };

    useEffect(() => {
        localStorage.setItem('entriesPerPage', JSON.stringify(snmpTrapsPerPage));
    }, [snmpTrapsPerPage]);

    useEffect(() => {
        loadSnmpTraps();
    }, [currentPage, snmpTrapsPerPage, filterParams, selectedTimeRange]);

    useEffect(() => {
        fetchSnmpTrapOids();
        fetchAgents();
        fetchOids();
        fetchSnmpTrapTags();
        fetchTrapTags();
    }, []);

    useEffect(() => {
        console.log('SNMP OID data in SNMPTraps:', oids);
    }, []);


    const fetchTrapTags = () => {
        apiClient
            .get('/traps/tags/')
            .then((response) => {
                console.log('SNMP Trap Tags list:', response.data);
                const namesList = response.data.map(tag => tag.name);
                setTagNames(namesList);
                const tagsObject = response.data.reduce((acc, tag) => {
                    acc[tag.id] = tag.name;
                    return acc;
                }, {});
                setTags(tagsObject);
                setTrapTags(response.data);
            })
            .catch((error) => {
                console.error('Error fetching SNMP Users:', error);
            });
    };

    const fetchSnmpTrapOids = async () => {
        try {
            const response = await apiClient.get('/traps/trapoid/');
            const trapOids = response.data.map((trapOid) => ({
                id: trapOid.id,
                label: trapOid.label,
            }));
            setSnmpTrapOids(trapOids);
        } catch (error) {
            console.error('Error fetching agent data:', error);
        }
    };

    const fetchOids = async () => {
        try {
            const response = await apiClient.get('/traps/oid/');
            const Oids = response.data.map((Oid) => ({
                id: Oid.id,
                label: Oid.label,
                name: Oid.label,
            }));
            setOids(Oids);
        } catch (error) {
            console.error('Error fetching agent data:', error);
        }
    };

    const fetchSnmpTrapTags = () => {
        apiClient
            .get(`/traps/tags/`)
            .then((response) => {
                const Oids = response.data.map((Oid) => ({
                    id: Oid.id,
                    name: Oid.name,
                }));
                setTrapTags(Oids);
                console.log('Oids List:', oids);
            })
            .catch((error) => {
                console.error('Error fetching mnemonic data:', error);
            });
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

    const loadSnmpTraps = () => {
        setLoading(true);

        const params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('perPage', snmpTrapsPerPage);

        const { agentFilters, hostnameFilters, tagFilters } = filterValues;
        if (agentFilters && agentFilters.length > 0) {
            agentFilters.forEach(agent => params.append('agent', agent.value));
        }
        if (hostnameFilters && hostnameFilters.length > 0) {
            hostnameFilters.forEach(hostname => params.append('hostname', hostname.value));
        }
        if (tagFilters && tagFilters.length > 0) {
            tagFilters.forEach(tag => params.append('tag', tag.value));
        }

        params.append('startTime', formatDateForUrl(selectedTimeRange.startDate));
        params.append('endTime', formatDateForUrl(selectedTimeRange.endDate));

        apiClient
            .get(`/traps/`)
            .then(response => {
                console.log('SNMP Traps:', response.data.results);
                setSnmpTraps(response.data);
                setTotalEntries(response.data.count);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching SNMP traps:', error);
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
        applyTimeRangeFilter(startDate, endDate, isCustomRangeVisible);
        setDropdowns((prevDropdowns) => ({
            ...prevDropdowns,
            dropdown4: { ...prevDropdowns.dropdown4, visible: false },
        }));
    };

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
            setSnmpTrapsPerPage(value);
            setCurrentPage(1);
        }
    };

    const totalPages = Math.ceil(totalEntries / snmpTrapsPerPage);

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
        setDropdowns((prevDropdowns) => ({
            ...prevDropdowns,
            dropdown6: { ...prevDropdowns.dropdown6, visible: false },
        }));
    };

    const handleSyslogTagsChange = (selectedOids) => {
        setSelectedTagFilters(selectedOids);
    };

    const handleSearchFiltering = (filters) => {
        console.log('Search Filters:', filters);

        const params = new URLSearchParams();

        if (filters.agent && filters.agent.length > 0) {
            filters.agent.forEach(agent => {
                params.append('agent', agent);
            });
        }

        if (filters.mnemonic && filters.mnemonic.length > 0) {
            filters.mnemonic.forEach(mnemonic => {
                params.append('mnemonic', mnemonic);
            });
        }

        if (filters.tags) {
            Object.keys(filters.tags).forEach(tagName => {
                const tagValues = filters.tags[tagName];
                if (tagValues && tagValues.length > 0) {
                    tagValues.forEach(tag => {
                        params.append(`tags__${tagName}`, tag);
                    });
                }
            });
        }

        const url = `/snmptraps/api/?page=1&perPage=31${params.toString() ? `&${params.toString()}` : ''}`;

        apiClient
            .get(`/traps/`)
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
                setSnmpTraps(results);
            })
            .catch(error => {
                console.error('Error fetching syslogs:', error);
            })
            .finally(() => {
                console.error('Loading complete');
            });
    };

    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    const handleTimeRangeSelect = (range) => {
        console.log('Selected timerange:', range)
        setSnmpTraps(null);
        setLoading(true);

        apiClient
            .get(`/traps/recent/?${range}`)
            .then(response => {
                console.log('SNMP Traps:', response.data.results);
                setSnmpTraps(response.data.results);
                setTotalEntries(response.data.count);
            })
            .catch(error => {
                console.error('Error fetching SNMP Traps:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    return (
        <div className="mainContainer">
            <div className="mainContainerHeader">
                <h2 className="mainContainerTitle">SNMP Trap Database</h2>
                <div className="mainContainerButtons">
                    <div className="headerButtons">
                        {currentUser.is_staff && (
                            <>
                                <button
                                    className={`iconButton ${dropdowns.injectSNMPTrap.visible ? 'active' : ''}`}
                                    onClick={(event) => handleButtonClick(event, 'injectSNMPTrap')}
                                >
                                    <BiInjection className="defaultIcon" />
                                    <BiSolidInjection className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${dropdowns.configureReceiver.visible ? 'active' : ''}`}
                                    onClick={(event) => handleButtonClick(event, 'configureReceiver')}
                                >
                                    <IoSettingsOutline className="defaultIcon" />
                                    <IoSettingsSharp className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${dropdowns.configureSNMPAuth.visible ? 'active' : ''}`}
                                    onClick={(event) => handleButtonClick(event, 'configureSNMPAuth')}
                                >
                                    <IoShieldCheckmarkOutline className="defaultIcon" />
                                    <IoShieldCheckmarkSharp className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${dropdowns.configureSNMPTrapOids.visible ? 'active' : ''}`}
                                    onClick={(event) => handleButtonClick(event, 'configureSNMPTrapOids')}
                                >
                                    <RiAddCircleLine className="defaultIcon" />
                                    <RiAddCircleFill className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${dropdowns.configureSNMPOids.visible ? 'active' : ''}`}
                                    style={{ marginRight: '20px' }}
                                    onClick={(event) => handleButtonClick(event, 'configureSNMPOids')}
                                >
                                    <MdBookmarkBorder className="defaultIcon" />
                                    <MdBookmark className="hoverIcon" />
                                </button>
                            </>
                        )}

                        <button
                            className="iconButton"
                            onClick={(event) => handleButtonClick(event, 'refreshData')}
                        >
                            <IoMdRefresh className="defaultIcon" />
                            <IoMdRefreshCircle className="hoverIcon" />
                        </button>
                        <button
                            className={`iconButton ${dropdowns.showSNMPOids.visible ? 'active' : ''}`}
                            onClick={(event) => handleButtonClick(event, 'showSNMPOids')}
                        >
                            <HiOutlineViewColumns
                                className={`defaultIcon ${selectedOids.length > 0 ? 'hasFilters' : 'noFilters'}`} />
                            <HiViewColumns className="hoverIcon" />
                        </button>
                        <button
                            className={`iconButton ${dropdowns.filterSNMPTraps.visible ? 'active' : ''}`}
                            onClick={(event) => handleButtonClick(event, 'filterSNMPTraps')}
                        >
                            <RiFilterLine className={`defaultIcon ${Object.values(selectedTagFilters).some((filterArray) => filterArray.length > 0)
                                ? 'hasFilters'
                                : 'noFilters'
                                }`} />
                            <RiFilterFill className="hoverIcon" />
                        </button>
                        <button
                            className={`iconButton ${dropdowns.filterTime.visible ? 'active' : ''}`}
                            onClick={(event) => handleButtonClick(event, 'filterTime')}
                        >
                            <FaRegClock className="defaultIcon" />
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
                            data={snmptraps}
                            columns={initialColumns}
                            signalSource="SNMPTraps"
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
                        <label htmlFor="snmpTrapsPerPage">Syslogs Per Page:</label>
                        <input
                            type="number"
                            id="snmpTrapsPerPage"
                            value={snmpTrapsPerPage}
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

            {/* Dropdown Menus */}
            <div
                className={`dropdownMenu ${dropdowns.injectSNMPTrap.visible ? 'dropdownVisible' : 'dropdownHidden'}`}>
                <InjectTraps devices={devices} />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.configureReceiver.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '320px', marginRight: '150px' }}>
                <ReceiverConfig />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.configureSNMPTrapOids.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: 'auto',
                    maxHeight: '740px',
                    overflow: 'hidden',
                    marginRight: '100px',
                }}
            >
                <TrapOIDConfig
                    currentUser={currentUser}
                    trapOids={snmpTrapOids}
                    oids={oids}
                    devices={devices}

                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.configureSNMPOids.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: 'auto',
                    maxHeight: '740px',
                    overflow: 'hidden',
                    marginRight: '70px',
                }}
            >
                <OIDConfig
                    currentUser={currentUser}
                    oids={oids || []}
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
                className={`dropdownMenu ${dropdowns.filterSNMPTraps.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: '400px',
                    maxHeight: '720px',
                    overflow: 'hidden',
                }}
            >
                <FilterTraps
                    tags={tagNames}
                    devices={devices}
                    snmpTrapOids={snmpTrapOids}
                    onSelectedTagsChange={handleSyslogTagsChange}
                    onSelectedTagsSearch={handleSearchFiltering}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.filterTime.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{ width: '460px' }}
            >

                <SearchTime
                    onTimeRangeSelect={handleTimeRangeSelect}
                    onTimeRangeChange={handleTimeRangeChange}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.showSNMPOids.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: '300px',
                    maxHeight: '700px',
                    overflow: 'hidden',
                }}
            >
                <TagColumns
                    tags={tagNames}
                    selectedTags={selectedOids}
                    handleTagCheckboxChange={handleTagCheckboxChange}
                />
            </div>
            <div
                className={`dropdownMenu ${dropdowns.configureSNMPAuth.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: '640px',
                    height: 'auto',
                    maxHeight: '700px',
                    overflow: 'hidden',
                }}
            >
                <UsersConfig
                    snmpUsers={snmpUsers}
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
                className={`dropdownMenu ${dropdowns.trapTags.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
                style={{
                    width: '700px',
                    height: 'auto',
                    maxHeight: '700px',
                    overflow: 'hidden',
                }}
            >
                {/*<TagsConfig
                    currentUser={currentUser}
                    trapOids={snmpTrapOids}
                    oids={oids}
                    devices={devices}
                />*/}
            </div>
        </div>
    );
}

export default SNMPTraps;
