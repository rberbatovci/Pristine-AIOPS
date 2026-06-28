import { useState, useEffect, useRef } from 'react';
import '../../../css/SyslogDatabase.css';
import EventsTable from '../../../components/misc/EventsTable.js'; 
import { useSyslogTags } from '../../../hooks/useSyslogTags';
import { useMnemonics } from '../../../hooks/useMnemonics';
import { useSyslogRegEx } from '../../../hooks/useSyslogRegEx';
import { useSignalData } from '../../../hooks/useSignalData';
import { NavLink, useLocation } from 'react-router-dom';

function TelemetrySignalTable({ currentUser, setDashboardTitle, showNotification, keycloak, startTime, endTime }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useSignalData();
    const [page, setPage] = useState(1); 
    const [filters, setFilters] = useState({ device: [], mnemonic: [] });
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const { syslogTags, reload: reloadSyslogTags } = useSyslogTags(keycloak);
    const { mnemonics, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { regexes, reload: reloadRegEx } = useSyslogRegEx(keycloak);

    console.log("Start Time in Telemetry Signal Table:", startTime);
    console.log("End Time in Telemetry Signal Table:", endTime);

    useEffect(() => {
        loadData(
            keycloak,
            "telemetry",
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            { ...filters, tags: selectedTags }
        );
    }, [keycloak, page, startTime, endTime, filters, selectedTags, loadData]);

    const tags = [
        { label: 'Status', value: 'status' },
        { label: 'Start Time', value: 'startTime' },
        { label: 'End Time', value: 'endTime' },
        { label: 'Device', value: 'device' },
        { label: 'Severity', value: 'severity' },
        { label: 'Rule', value: 'rule' },
        { label: 'Affected Entities', value: 'affectedEntity' },
        { label: 'Description', value: 'description' },
    ];

    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    useEffect(() => {
        setDashboardTitle("Signals Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    useEffect(() => {
        reloadSyslogTags(keycloak);
        reloadMnemonics(keycloak);
    }, []);

    return (
        <div className="mainContainer" ref={dropdownWrapperRef}>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <>
                        <div className="syslogsTableContainer">
                            <EventsTable
                                keycloak={keycloak}
                                dataSource="syslogs"
                                data={eventsData}
                                totalPages={totalPages}
                                tags={tags}
                                signalSource="syslogs"
                                onRowSelectChange={handleRowSelectChange}
                                page={page}
                                onPageChange={setPage}
                                selectedTags={selectedTags}
                                onTagSelectChange={setSelectedTags}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default TelemetrySignalTable;