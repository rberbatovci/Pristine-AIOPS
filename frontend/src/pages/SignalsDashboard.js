import React, { useState, useEffect } from 'react';
import List from '../components/signals/List.js';
import Info from '../components/signals/Info.js';
import Timeline from '../components/signals/Timeline.js';
import Events from '../components/signals/Events.js';
import '../css/Signals.css';
import SyslogSignalsConfig from '../components/signals/config/SyslogSignals.js';
import StatefulTraps from '../components/signals/config/StatefulTraps.js';
import SyslogSignalFilters from '../components/signals/filters/SyslogSignals.js';
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import apiClient from '../components/misc/AxiosConfig.js';
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import SearchTime from '../components/misc/SearchTime.js';
import { FaClock, FaRegClock } from "react-icons/fa";

const SignalsDashboard = ({ currentUser }) => {
    const [signals, setSignals] = useState([]);
    const [filteredSignals, setFilteredSignals] = useState([]);
    const [selectedSignal, setSelectedSignal] = useState(null);
    const [selectedSignalRule, setSelectedSignalRule] = useState(null);
    const [correlatedSyslogs, setCorrelatedSyslogs] = useState(null);
    const [events, setEvents] = useState([]);
    const [showComponents, setShowComponents] = useState(false);
    const [isDropdownVisible, setIsDropdownVisible] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [error, setError] = useState(null);
    const [syslogSignals, setSyslogSignals] = useState([]);
    const [trapSignals, setTrapSignals] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSignalId, setSelectedSignalId] = useState(null);
    const [message, setMessage] = useState([]);
    const [dataSource, setDataSource] = useState('syslogs');
    const [filters, setFilters] = useState({
        signals: [],
        syslogTags: [],
        snmpTraps: [],

        dateRange: [null, null],
    });

    useEffect(() => {
        const socket = new WebSocket("ws://127.0.0.1:8000/ws/syslogSignals/");
        socket.onopen = () => {
            console.log("WebSocket connected");
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log("Received:", data);
            if (data.type === "signalUpdate") {
                setSignals((prevFilteredSignals) =>
                    prevFilteredSignals.map((signal) =>
                        signal.id === data.id ? { ...signal, state: data.state } : signal
                    )
                );
            } else if (data.type === "newSignal") {
                try {
                    const response = await apiClient.get(`/signals/syslogSignals/${data.id}/`);
                    const newSignal = response.data;
                    setSignals((prevFilteredSignals) => [newSignal, ...prevFilteredSignals]);
                } catch (error) {
                    console.error("Error fetching new signal:", error);
                }
            }
        };

        socket.onclose = () => {
            console.log("WebSocket disconnected");
        };

        return () => socket.close();
    }, []);

    useEffect(() => {
        const fetchSignals = async () => {
            try {
                const params = new URLSearchParams();

                if (filters.signals?.hostname?.length > 0) {
                    filters.signals.hostname.forEach((host) => {
                        params.append('device', host);
                    });
                }

                if (Array.isArray(filters.dateRange) && filters.dateRange[0]) {
                    params.append('startTime', formatDateForUrl(filters.dateRange[0]));
                }
                if (Array.isArray(filters.dateRange) && filters.dateRange[1]) {
                    params.append('endTime', formatDateForUrl(filters.dateRange[1]));
                }

                if (filters.syslogTags) {
                    Object.entries(filters.syslogTags).forEach(([syslogTag, tagValues]) => {
                        tagValues.forEach((tag) => {
                            if (tag?.value) {
                                params.append(`affectedEntity__${syslogTag}`, tag.value);
                            }
                        });
                    });
                }

                const url = `/signals/syslogsignals/?${params.toString()}`;
                console.log('Fetching signals with URL:', url);

                const response = await apiClient.get(url);

                const extractedSignals = response.data.results.map((item) => {
                    const source = item._source;
                    return {
                        id: source.signal_id,                // map signal_id to id
                        startTime: source['@startTime'],     // map @startTime to startTime
                        ...source                             // include all other fields as-is
                    };
                });

                setSignals(extractedSignals);
                setFilteredSignals(extractedSignals);
            } catch (error) {
                console.error('Error fetching signals:', error);
                setError('Failed to fetch signals. Please try again later.');
            }
        };

        if (filters && Object.keys(filters).length > 0) {
            fetchSignals();
        }
    }, [filters]);


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
            await apiClient.delete('/signals/deleteAllSyslogSignals/');
            setSignals([]);
            setFilteredSignals([]);
        } catch (error) {
            console.error('Error deleting signals:', error);
        }
    };

    const handleSearchFilters = (newFilters) => {
        setFilters(newFilters);
        console.log('New Filters in Signals Component:', newFilters);
    };

    const handleSignalSelect = async (signal) => {
        setSelectedSignal(signal);
        setSelectedSignalId(signal.id);
        console.log('Selected Signal:', signal);
        console.log('Correlated Syslog IDs:', signal.events);
        try {

            if (signal.events && signal.events.length > 0) {
                const syslogIds = signal.events;
                console.log('Correlated Syslog IDs:', syslogIds);
                const eventsEndpoint = `/syslogs/bulk`;
                console.log('Fetching bulk syslogs with IDs:', syslogIds);
                const eventsResponse = await apiClient.post(eventsEndpoint, { syslog_ids: syslogIds });
                setEvents(eventsResponse.data.results); // Assuming your bulk endpoint returns results in a 'results' array
            } else {
                setEvents([]); // No events to fetch
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
        setShowComponents(false);
    }

    console.log('Current User:', currentUser);

    const handleTimeRangeChange = (startDate, endDate) => {
    };

    const handleTimeRangeSelect = (range) => {
    }

    const handleHeaderClick = (source) => {
        setDataSource(source);
    };

    return (
        <div className="signals-container" style={{ width: selectedSignal ? '80%' : '50%' }}>
            <div className="left-column" style={{ width: selectedSignal ? '40%' : '100%', height: '100vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h2 style={{ marginTop: '-5px', paddingLeft: '20px', fontSize: '23px', color: 'var(--text-color)' }}>Syslog Signals</h2>
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
                    <div style={{ marginRight: '10px', display: 'flex', alignItems: 'center' }}>
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
                            placeholder="Search Event..."
                        />
                        {!selectedSignal && (
                            <>
                                <button className="iconButton" onClick={handleDeleteAllSignals}>
                                    <MdOutlineDeleteForever className="defaultIcon" />
                                    <MdDeleteForever className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'time' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('time')}
                                >
                                    <FaRegClock className="defaultIcon hasFilters" />
                                    <FaClock className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'traps' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('traps')}
                                >
                                    <IoSettingsOutline className="defaultIcon" />
                                    <IoSettingsSharp className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'config' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('config')}
                                >
                                    <IoSettingsOutline className="defaultIcon" />
                                    <IoSettingsSharp className="hoverIcon" />
                                </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'search' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('search')}
                                >
                                    <RiFilterLine className="defaultIcon" />
                                    <RiFilterFill className="hoverIcon" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                {isDropdownVisible && (
                    <div>
                        {activeDropdown === 'config' && <SyslogSignalsConfig/>}
                        {activeDropdown === 'traps' && <StatefulTraps />}
                        {activeDropdown === 'time' && < SearchTime
                            onTimeRangeSelect={handleTimeRangeSelect}
                            onTimeRangeChange={handleTimeRangeChange}
                        />}
                        {activeDropdown === 'search' && <SyslogSignalFilters onSearch={handleSearchFilters} />}
                    </div>
                )}
                <div style={{ marginTop: '10px', marginLeft: '10px', marginRight: '10px', marginBottom: '5px', background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', height: 'calc(100vh - 185px)', overflowY: 'auto' }}>
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
                                    <Info currentUser={currentUser} selectedSignal={selectedSignal} events={events} onSignalDeselect={handleSignalDeselect} />
                                    <Timeline currentUser={currentUser} selectedSignal={selectedSignal} events={events} />
                                    <Events currentUser={currentUser} events={events} source="syslog" rule={selectedSignalRule} />
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
