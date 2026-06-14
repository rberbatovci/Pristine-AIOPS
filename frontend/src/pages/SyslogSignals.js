import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import ChartView from '../components/misc/ChartView.js'; // Used below in place of unimported Statistics

import { useSyslogTags } from '../hooks/useSyslogTags';
import { useMnemonics } from '../hooks/useMnemonics';
import { useSyslogRegEx } from '../hooks/useSyslogRegEx';
import { useFaultData } from '../hooks/useFaultData';

function SyslogSignals({ currentUser, setDashboardTitle, showNotification, keycloak }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData();
    const [tags, setTags] = useState([]);
    const [page, setPage] = useState(1);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [filters, setFilters] = useState({ device: [], mnemonic: [] });
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);

    // 1. Dedicated state to track selected tags
    const [selectedTags, setSelectedTags] = useState([]);

    // Load tags for filtering
    const { syslogTags, reload: reloadSyslogTags } = useSyslogTags(keycloak);
    const { mnemonics, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { regexes, reload: reloadRegEx } = useSyslogRegEx(keycloak);

    useEffect(() => {
        // 2. Include selectedTags inside your API query payload so the backend filters data dynamically
        loadData(
            keycloak,
            "syslogs",
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            { ...filters, tags: selectedTags }
        );
        // 3. Added selectedTags to the dependency array so changes trigger a re-fetch
    }, [keycloak, page, startTime, endTime, filters, selectedTags, loadData]);

    // Fixed trailing comma syntax error
    const columnConfigs = [
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'Device', value: 'device' },
        { label: 'Severity', value: 'severity' },
        { label: 'Mnemonic', value: 'mnemonic' },
        { label: 'Message', value: 'message' },
    ];

    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    useEffect(() => {
        setDashboardTitle("Signals Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    return (
        <div className="mainContainer" ref={dropdownWrapperRef}>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <>
                        {view === 'list' && (
                            <div className="syslogsTableContainer">
                                <EventsTable
                                    dataSource="syslogs"
                                    data={eventsData}
                                    totalPages={totalPages}
                                    tags={tags}
                                    signalSource="syslogs"
                                    onRowSelectChange={handleRowSelectChange}
                                    page={page}
                                    onPageChange={setPage}
                                    // Pass state mutators down if your table handles tag selection filtering
                                    selectedTags={selectedTags}
                                    onTagSelectChange={setSelectedTags}
                                />
                            </div>
                        )}
                        {view === 'chart' && (
                            <div className="syslogsTableContainer">
                                {/* Swapped Statistics for ChartView and passed down the state array directly */}
                                <ChartView
                                    keycloak={keycloak}
                                    source="events"
                                    dataSource="syslogs"
                                    selectedTags={selectedTags}
                                    tags={tags}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default SyslogSignals;