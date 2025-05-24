import React, { useState, useEffect } from 'react';
import List from '../components/incidents/List.js';
import Info from '../components/incidents/Info.js';
import Timeline from '../components/incidents/Timeline.js';
import Events from '../components/incidents/Events.js';
import '../css/Signals.css';
import Filters from '../components/incidents/Filters.js';
import { IoSettingsOutline, IoSettingsSharp } from "react-icons/io5";
import apiClient from '../components/misc/AxiosConfig.js';
import { RiFilterLine, RiFilterFill } from "react-icons/ri";
import { MdDeleteForever, MdOutlineDeleteForever } from "react-icons/md";
import SearchTime from '../components/misc/SearchTime.js';
import { FaClock, FaRegClock } from "react-icons/fa";
import ConfigDashboard from '../components/incidents/config/ConfigDashboard.js';

const Incidents = ({ currentUser }) => {
    const [signals, setSignals] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [selectedIncident, setSelectedIncident] = useState(null);
    const [selectedIncidentId, setSelectedIncidentId] = useState([]);
    const [selectedSyslogSignals, setSelectedSyslogSignals] = useState([]);
    const [selectedTrapSignals, setSelectedTrapSignals] = useState([]);
    const [selectedSyslogEvents, setSelectedSyslogEvents] = useState([]);
    const [selectedTrapEvents, setSelectedTrapEvents] = useState([]);
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
    const [filters, setFilters] = useState({
        signals: [],
        syslogTags: [],
        snmpTraps: [],

        dateRange: [null, null],
    });

    useEffect(() => {
        const socket = new WebSocket("ws://localhost:8000/ws/incidents/");
        socket.onopen = () => {
            console.log("WebSocket connected");
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log("Received:", data);
        };

        socket.onclose = () => {
            console.log("WebSocket disconnected");
        };

        return () => socket.close();
    }, []);

    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const response = await apiClient.get(`/incidents/incident/`);
                setIncidents(response.data);
            } catch (error) {
                console.error('Error fetching incidents:', error);
                setError('Failed to fetch incidents. Please try again later.');
            }
        };

        fetchIncidents();
    }, []);


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

    const handleDeleteIncidents = async () => {
        try {
            await apiClient.delete('/incidents/deleteAllIncident/');
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

    const handleIncidentSelect = async (incident) => {
        setSelectedIncident(incident);
        setSelectedIncidentId(incident.id);
        setIsLoading(true);

        try {
            // Fetch incident details
            const incidentResponse = await apiClient.get(`/incidents/incident/${incident.id}/`);
            setSelectedIncident(incidentResponse.data);

            // Fetch syslog signals
            let syslogSignalsWithEvents = [];
            if (incident.syslogSignals.length > 0) {
                const syslogRequests = incident.syslogSignals.map(id => apiClient.get(`/signals/syslogSignals/${id}/`));
                const syslogResponses = await Promise.all(syslogRequests);
                syslogSignalsWithEvents = syslogResponses.map(response => response.data);

                // Collect all event IDs from all syslog signals
                const allSyslogEventIds = syslogSignalsWithEvents.flatMap(signal => signal.events);

                // Fetch all syslog events in one request
                if (allSyslogEventIds.length > 0) {
                    const syslogEventIdsParam = allSyslogEventIds.join(',');
                    const eventsResponse = await apiClient.get(`/syslogs/api/correlated/?ids=${syslogEventIdsParam}`);
                    const syslogEvents = eventsResponse.data;

                    // Attach events to their respective syslog signals
                    syslogSignalsWithEvents = syslogSignalsWithEvents.map(signal => ({
                        ...signal,
                        events: syslogEvents.filter(event => signal.events.includes(event.id))
                    }));

                    // Populate selectedSyslogSignals and selectedSyslogEvents
                    setSelectedSyslogSignals(syslogSignalsWithEvents);
                    setSelectedSyslogEvents(syslogEvents);
                } else {
                    // If no events, set empty arrays
                    setSelectedSyslogSignals(syslogSignalsWithEvents);
                    setSelectedSyslogEvents([]);
                }
            } else {
                // If no syslog signals, set empty arrays
                setSelectedSyslogSignals([]);
                setSelectedSyslogEvents([]);
            }

            // Fetch SNMP trap signals
            let trapSignalsWithEvents = [];
            if (incident.trapSignals.length > 0) {
                const trapRequests = incident.trapSignals.map(id => apiClient.get(`/signals/trapSignals/${id}/`));
                const trapResponses = await Promise.all(trapRequests);
                trapSignalsWithEvents = trapResponses.map(response => response.data);

                // Collect all event IDs from all trap signals
                const allTrapEventIds = trapSignalsWithEvents.flatMap(signal => signal.events);

                // Fetch all trap events in one request
                if (allTrapEventIds.length > 0) {
                    const trapEventIdsParam = allTrapEventIds.join(',');
                    const eventsResponse = await apiClient.get(`/snmptraps/api/correlated/?ids=${trapEventIdsParam}`);
                    const trapEvents = eventsResponse.data;

                    // Attach events to their respective trap signals
                    trapSignalsWithEvents = trapSignalsWithEvents.map(signal => ({
                        ...signal,
                        events: trapEvents.filter(event => signal.events.includes(event.id))
                    }));

                    // Populate selectedTrapSignals and selectedTrapEvents
                    setSelectedTrapSignals(trapSignalsWithEvents);
                    setSelectedTrapEvents(trapEvents);
                } else {
                    // If no events, set empty arrays
                    setSelectedTrapSignals(trapSignalsWithEvents);
                    setSelectedTrapEvents([]);
                }
            } else {
                // If no trap signals, set empty arrays
                setSelectedTrapSignals([]);
                setSelectedTrapEvents([]);
            }

            setShowComponents(true);
        } catch (error) {
            console.error('Error fetching incident details or signals:', error);
            setError('Failed to fetch incident details. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleIncidentDeselect = () => {
        setSelectedIncident(null);
        setShowComponents(false);
    }

    const handleTimeRangeChange = (startDate, endDate) => {
    };

    const handleTimeRangeSelect = (range) => {
    }

    return (
        <div className="signals-container" style={{ width: selectedIncident ? '80%' : '50%' }}>
            <div className="left-column" style={{ width: selectedIncident ? '40%' : '100%', height: '100vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h2 style={{ marginTop: '-5px', paddingLeft: '20px', fontSize: '23px', color: 'var(--text-color)' }}>Incidents Dashboard</h2>
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
                        {!selectedIncident && (
                            <>
                                <button className="iconButton" onClick={handleDeleteIncidents}>
                                    <MdOutlineDeleteForever className="defaultIcon" />
                                    <MdDeleteForever className="hoverIcon" />
                                </button>
                                <button
                                        className={`iconButton ${activeDropdown === 'settings' ? 'active' : ''}`}
                                        onClick={() => toggleDropdown('settings')}
                                    >
                                        <IoSettingsOutline className="defaultIcon" />
                                        <IoSettingsSharp className="hoverIcon" />
                                    </button>
                                <button
                                    className={`iconButton ${activeDropdown === 'time' ? 'active' : ''}`}
                                    onClick={() => toggleDropdown('time')}
                                >
                                    <FaRegClock className="defaultIcon hasFilters" />
                                    <FaClock className="hoverIcon" />
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
                    <div className="dropdown-menu">
                        {activeDropdown === 'time' && < SearchTime
                            onTimeRangeSelect={handleTimeRangeSelect}
                            onTimeRangeChange={handleTimeRangeChange}
                        />}
                        {activeDropdown === 'settings' && <ConfigDashboard />}
                        {activeDropdown === 'search' && <Filters onSearch={handleSearchFilters} />}
                    </div>
                )}
                <div style={{ marginTop: '10px', marginLeft: '10px', marginRight: '10px', marginBottom: '5px', background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', height: 'calc(100vh - 185px)', overflowY: 'auto' }}>
                    <List
                        signals={incidents}
                        onIncidentSelect={handleIncidentSelect}
                    />
                </div>
            </div>

            {/* Right Column */}
            {selectedIncident && (
                <div className="right-column">
                    <div className="right-content-wrapper" style={{ transition: '0.5s' }}>
                        <div className="right-content">
                            {showComponents && (
                                <>
                                    <Info currentUser={currentUser} selectedIncident={selectedIncident} events={events} onIncidentDeselect={handleIncidentDeselect} />
                                    <Timeline currentUser={currentUser} selectedIncident={selectedIncident} events={events} />
                                    <Events currentUser={currentUser} events={selectedSyslogEvents} syslogEvents={selectedSyslogEvents} trapEvents={selectedTrapEvents} source="syslog" rule={selectedSignalRule} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Incidents;
