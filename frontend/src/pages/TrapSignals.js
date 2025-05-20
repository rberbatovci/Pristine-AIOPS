import React, { useState, useEffect } from 'react';
import List from '../components/signals/List.js';
import Info from '../components/signals/Info.js';
import Timeline from '../components/signals/Timeline.js';
import Events from '../components/signals/Events.js';
import '../css/Signals.css';
import TrapSignalsConfig from '../components/signals/config/TrapSignals.js';
import TrapSignalFilters from '../components/signals/filters/TrapSignals.js';
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import apiClient from '../components/misc/AxiosConfig.js';
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import SearchTime from '../components/misc/SearchTime.js';
import { FaClock, FaRegClock } from "react-icons/fa";

const TrapSignals = ({ currentUser }) => {
    const [signals, setSignals] = useState([]);
    const [filteredSignals, setFilteredSignals] = useState([]);
    const [selectedSignalRule, setSelectedSignalRule] = useState(null);
    const [selectedSignal, setSelectedSignal] = useState(null);
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
    const [filters, setFilters] = useState({
        signals: [],
        syslogTags: [],
        snmpTraps: [],
        dateRange: [null, null],
    });

    useEffect(() => {
        const socket = new WebSocket("ws://127.0.0.1:8000/ws/trapSignals/");
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
                    const response = await apiClient.get(`/signals/trapSignals/${data.id}/`);
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

                const url = `/signals/trapSignals/list/?${params.toString()}`;
                console.log('Fetching signals with URL:', url);

                const response = await apiClient.get(url);
                setSignals(response.data);
                setFilteredSignals(response.data);
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
            await apiClient.delete('/signals/deleteAllTrapSignals/');
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

        try {
            console.log(`Fetching details for signal ID: ${signal.id}`);

            let endpoint;
            endpoint = `/signals/trapSignals/${signal.id}/`;

            const signalResponse = await apiClient.get(endpoint);
            setSelectedSignal(signalResponse.data);

            if (signalResponse.data.events) {
                let eventsEndpoint;
                const snmpTrapIds = signalResponse.data.events.join(',');
                eventsEndpoint = `/snmptraps/api/correlated/?ids=${snmpTrapIds}`;
                const eventsResponse = await apiClient.get(eventsEndpoint);
                setEvents(eventsResponse.data);
            }

            if (signalResponse.data.rule) {
                const ruleEndpoint = `/snmptraps/statefultraprules/by_name/?name=${signalResponse.data.rule}`;
                const ruleResponse = await apiClient.get(ruleEndpoint);
                setSelectedSignalRule(ruleResponse.data);
            }

            setShowComponents(true);
        } catch (error) {
            console.error('Error fetching signal details:', error);
            setError('Failed to fetch signal details. Please try again later.');
        }
    };

    const handleTimeRangeChange = (startDate, endDate) => {
    };


    const handleSignalDeselect = () => {
        setSelectedSignal(null);
        setCorrelatedSyslogs(null);
        setShowComponents(false);
    }

    const handleTimeRangeSelect = (range) => {
    }

    return (
        <div className="signals-container" style={{ width: selectedSignal ? '80%' : '50%' }}>
            <div className="left-column" style={{ width: selectedSignal ? '40%' : '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h2 style={{ marginTop: '-5px', paddingLeft: '20px', fontSize: '23px', color: 'var(--text-color)' }}>Trap Signals</h2>
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
                {/* Dropdown Menu */}
                {isDropdownVisible && (
                    <div className="dropdown-menu">
                        {activeDropdown === 'config' && <TrapSignalsConfig />}
                        {activeDropdown === 'time' && < SearchTime
                            onTimeRangeSelect={handleTimeRangeSelect}
                            onTimeRangeChange={handleTimeRangeChange}
                        />}
                        {activeDropdown === 'search' && <TrapSignalFilters onSearch={handleSearchFilters} />}
                    </div>
                )}
                {/* Signals List */}
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
                                    <Events currentUser={currentUser} events={events} source="snmptrap" rule={selectedSignalRule} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrapSignals;
