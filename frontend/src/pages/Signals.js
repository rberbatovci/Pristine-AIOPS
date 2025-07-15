import React, { useState, useRef, useEffect } from 'react';
import List from '../components/signals/List.js';
import Info from '../components/signals/Info.js';
import Timeline from '../components/signals/Timeline.js';
import Events from '../components/signals/Events.js';
import '../css/Signals.css';
import SyslogSignalsConfig from '../components/signals/config/SyslogSignals.js';
import StatefulTraps from '../components/signals/config/StatefulTraps.js';
import SyslogSignalFilters from '../components/signals/filters/SyslogSignals.js';
import TrapSignalFilters from '../components/signals/filters/TrapSignals.js'; // Import Trap filters
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import apiClient from '../components/misc/AxiosConfig.js';
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import SearchTime from '../components/misc/SearchTime.js';
import { FaClock, FaRegClock } from "react-icons/fa";
import { IoSearchCircleOutline, IoSearchCircleSharp } from "react-icons/io5";

const SignalsDashboard = ({ currentUser, setDashboardTitle }) => {
    const [signals, setSignals] = useState([]);
    const [filteredSignals, setFilteredSignals] = useState([]);
    const [selectedSignal, setSelectedSignal] = useState(null);
    const [selectedSignalRule, setSelectedSignalRule] = useState(null);
    const [correlatedSyslogs, setCorrelatedSyslogs] = useState(null);
    const [correlatedTraps, setCorrelatedTraps] = useState(null); // State for correlated traps
    const [events, setEvents] = useState([]);
    const [showComponents, setShowComponents] = useState(false);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSignalId, setSelectedSignalId] = useState(null);
    const [dataSource, setDataSource] = useState('syslogs');
    const [showSearchInput, setShowSearchInput] = useState(false);
    const searchInputRef = useRef(null);
    const [filters, setFilters] = useState({
        syslogs: {
            signals: [],
            syslogTags: [],
            dateRange: [null, null],
        },
        traps: {
            signals: [],
            snmpTraps: [],
            dateRange: [null, null],
        },
    });

    useEffect(() => {
        const fetchSignals = async () => {
            setIsLoading(true);
            setError(null);
            try {
                let url = '';
                const params = new URLSearchParams();

                if (dataSource === 'syslogs') {
                    url = `/signals/syslogsignals/`;
                    const syslogFilters = filters.syslogs;
                    if (syslogFilters?.signals?.hostname?.length > 0) {
                        syslogFilters.signals.hostname.forEach((host) => {
                            params.append('device', host);
                        });
                    }
                    if (Array.isArray(syslogFilters.dateRange) && syslogFilters.dateRange[0]) {
                        params.append('startTime', formatDateForUrl(syslogFilters.dateRange[0]));
                    }
                    if (Array.isArray(syslogFilters.dateRange) && syslogFilters.dateRange[1]) {
                        params.append('endTime', formatDateForUrl(syslogFilters.dateRange[1]));
                    }
                    if (syslogFilters.syslogTags) {
                        Object.entries(syslogFilters.syslogTags).forEach(([syslogTag, tagValues]) => {
                            tagValues.forEach((tag) => {
                                if (tag?.value) {
                                    params.append(`affectedEntity__${syslogTag}`, tag.value);
                                }
                            });
                        });
                    }
                } else if (dataSource === 'traps') {
                    url = `/signals/trapsignals/`;
                    const trapFilters = filters.traps;
                    // Apply trap-specific filters here if needed
                    if (Array.isArray(trapFilters.dateRange) && trapFilters.dateRange[0]) {
                        params.append('startTime', formatDateForUrl(trapFilters.dateRange[0]));
                    }
                    if (Array.isArray(trapFilters.dateRange) && trapFilters.dateRange[1]) {
                        params.append('endTime', formatDateForUrl(trapFilters.dateRange[1]));
                    }
                    // Add filters for SNMP Traps if you have them in the state
                }

                const finalUrl = `${url}?${params.toString()}`;
                console.log('Fetching signals with URL:', finalUrl);
                const response = await apiClient.get(finalUrl);

                const extractedSignals = response.data.results.map((item) => {
                    const source = item._source;
                    return {
                        id: source.signal_id || item.id, // Use item.id for traps? Adjust based on API response
                        startTime: source['@startTime'] || item.startTime, // Adjust based on API response
                        endTime: source['@endTime'] || item.endTime, // Adjust based on API response
                        ...source,
                        ...item, // Include all other fields from both _source and the item itself
                    };
                });

                setSignals(extractedSignals);
                setFilteredSignals(extractedSignals);
            } catch (err) {
                console.error('Error fetching signals:', err);
                setError('Failed to fetch signals. Please try again later.');
                setSignals([]);
                setFilteredSignals([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSignals();
    }, [dataSource, filters.syslogs, filters.traps]);

    const toggleDropdown = (type) => {
        if (activeDropdown === type) {
            setIsDropdownVisible(false);
            setActiveDropdown(null);
        } else {
            setIsDropdownVisible(true);
            setActiveDropdown(type);
        }
    };

    const formatDateForUrl = (date) => {
        return new Date(date).toISOString();
    };

    const handleDeleteAllSignals = async () => {
        try {
            let deleteUrl = '';
            if (dataSource === 'syslogs') {
                deleteUrl = '/signals/deleteAllSyslogSignals/';
            } else if (dataSource === 'traps') {
                deleteUrl = '/signals/deleteAllTrapSignals/'; // Assuming this endpoint exists
            }
            await apiClient.delete(deleteUrl);
            setSignals([]);
            setFilteredSignals([]);
        } catch (error) {
            console.error('Error deleting signals:', error);
        }
    };

    const handleSearchFilters = (newFilters) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [dataSource]: newFilters,
        }));
        console.log(`New Filters for ${dataSource}:`, newFilters);
    };

    const handleSignalSelect = async (signal) => {
        setSelectedSignal(signal);
        setSelectedSignalId(signal.id);
        console.log('Selected Signal:', signal);
        setEvents([]); // Clear previous events

        try {
            if (signal.events && signal.events.length > 0 && dataSource === 'syslogs') {
                const syslogIds = signal.events;
                console.log('Correlated Syslog IDs:', syslogIds);
                const eventsEndpoint = `/syslogs/bulk`;
                const eventsResponse = await apiClient.post(eventsEndpoint, { syslog_ids: syslogIds });
                setEvents(eventsResponse.data.results);
            } else if (dataSource === 'traps') {
                const trapIds = signal.events;
                console.log('Correlated Trap IDs:', trapIds);
                const eventsEndpoint = `/traps/bulk`;
                const eventsResponse = await apiClient.post(eventsEndpoint, { trap_ids: trapIds });
                setEvents(eventsResponse.data.results);
            }
            setShowComponents(true);
        } catch (error) {
            console.error('Error fetching signal details:', error);
            setError('Failed to fetch signal details. Please try again later.');
        }
    };

    const handleSignalDeselect = () => {
        setSelectedSignal(null);
        setCorrelatedSyslogs(null);
        setCorrelatedTraps(null);
        setShowComponents(false);
    }

    console.log('Current User:', currentUser);

    const handleTimeRangeChange = (startDate, endDate) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [dataSource]: {
                ...prevFilters[dataSource],
                dateRange: [startDate, endDate],
            },
        }));
    };

    const handleTimeRangeSelect = (range) => {
        // You might want to update the filters directly here as well
        console.log('Time range selected:', range);
    }

    const handleHeaderClick = (source) => {
        setDataSource(source);
        setSelectedSignal(null); // Deselect any previously selected signal
        setShowComponents(false); // Hide the right column components
    };

    useEffect(() => {
        setDashboardTitle("Signals Dashboard");
        return () => setDashboardTitle(''); // Clean up when navigating away
    }, [setDashboardTitle]);

    const handleSearchClick = () => {
        setShowSearchInput(prev => !prev);
    };

    useEffect(() => {
        if (showSearchInput && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [showSearchInput]);

    return (
        <div className="signals-container" style={{ width: selectedSignal ? '80%' : '50%' }}>
            <div className="left-column" style={{ width: selectedSignal ? '40%' : '100%', height: '100vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {!selectedSignal && (
                        <>
                            <div style={{ display: 'flex' }}>
                                <h2
                                    className={`eventsTitleHeader ${dataSource === 'syslogs' ? 'eventsTitleHeaderActive' : ''}`}
                                    onClick={() => handleHeaderClick('syslogs')}
                                >
                                    Syslogs
                                </h2>
                                <h2
                                    className={`eventsTitleHeader ${dataSource === 'traps' ? 'eventsTitleHeaderActive' : ''}`}
                                    onClick={() => handleHeaderClick('traps')}
                                >
                                    Traps
                                </h2>
                            </div>
                        </>
                    )}
                    <div style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
                        {showSearchInput && (
                            <input
                                type="text"
                                style={{
                                    background: 'var(--background1)',
                                    border: 'none',
                                    outline: 'none',
                                    height: '30px',
                                    width: '250px',
                                    paddingLeft: '15px',
                                    color: 'white',
                                    fontSize: '15px',
                                    borderRadius: '10px',
                                    marginRight: '10px',
                                }}
                                placeholder={`Search ${dataSource === 'syslogs' ? 'Syslog Signal' : 'Trap Signal'}...`}
                            />
                        )}
                        {!selectedSignal && (
                            <>
                                <button
                                    className="iconButton"
                                    onClick={handleSearchClick}
                                >
                                    <IoSearchCircleOutline className="defaultIcon" />
                                    <IoSearchCircleSharp className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'search' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('search')}
                                >
                                    <RiFilterLine className="defaultIcon" />
                                    <RiFilterFill className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'time' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('time')}
                                >
                                    <FaRegClock className="defaultIcon hasFilters" />
                                    <FaClock className="hoverIcon" />
                                </button>

                                {dataSource === 'syslogs' && (
                                    <button
                                        className={`iconButton ${activeDropdown === 'syslogConfig' ? 'active' : ''}`}
                                        onClick={() => toggleDropdown('syslogConfig')}
                                    >
                                        <IoSettingsOutline className="defaultIcon" />
                                        <IoSettingsSharp className="hoverIcon" />
                                    </button>
                                )}
                                {dataSource === 'traps' && (
                                    <button
                                        className={`iconButton ${activeDropdown === 'trapConfig' ? 'active' : ''}`}
                                        onClick={() => toggleDropdown('trapConfig')}
                                    >
                                        <IoSettingsOutline className="defaultIcon" />
                                        <IoSettingsSharp className="hoverIcon" />
                                    </button>
                                )}

                            </>
                        )}
                    </div>
                </div>
                {isDropdownVisible && (
                    <div>
                        {activeDropdown === 'syslogConfig' && <SyslogSignalsConfig />}
                        {activeDropdown === 'trapConfig' && <StatefulTraps />}
                        {activeDropdown === 'time' && (
                            <SearchTime
                                onTimeRangeSelect={handleTimeRangeSelect}
                                onTimeRangeChange={handleTimeRangeChange}
                            />
                        )}
                        {activeDropdown === 'search' && dataSource === 'syslogs' && <SyslogSignalFilters onSearch={(f) => handleSearchFilters(f)} />}
                        {activeDropdown === 'search' && dataSource === 'traps' && <TrapSignalFilters onSearch={(f) => handleSearchFilters(f)} />}
                    </div>
                )}
                <div style={{ marginTop: '10px', marginLeft: '10px', marginRight: '10px', marginBottom: '5px', background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', height: 'calc(100vh - 190px)', overflowY: 'auto' }}>
                    <List
                        signals={signals}
                        onSignalSelect={handleSignalSelect}
                    />
                </div>
            </div>

            {/* Right Column */}
            {selectedSignal && (
                <div className="right-column">
                    <div className="right-content-wrapper" style={{ transition: '0.5s' }}>
                        <div className="right-content">
                            {showComponents && (
                                <>
                                    <Info currentUser={currentUser} selectedSignal={selectedSignal} events={events} onSignalDeselect={handleSignalDeselect} dataSource={dataSource} />
                                    <Timeline currentUser={currentUser} selectedSignal={selectedSignal} events={events} dataSource={dataSource} />
                                    <Events currentUser={currentUser} events={events} source={dataSource} rule={selectedSignalRule} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SignalsDashboard;