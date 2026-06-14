import { useState, useEffect, useRef } from 'react';
import '../../css/SyslogDatabase.css';
import EventsTable from '../../components/misc/EventsTable.js';
import ChartView from '../../components/misc/ChartView.js';
import { useSyslogTags } from '../../hooks/useSyslogTags';
import { useMnemonics } from '../../hooks/useMnemonics';
import { useSyslogRegEx } from '../../hooks/useSyslogRegEx';
import { useSignalData } from '../../hooks/useSignalData';
import { NavLink, useLocation } from 'react-router-dom';

function SnmpTrapSignalsTable({ currentUser, setDashboardTitle, showNotification, keycloak }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useSignalData(); 
    const [page, setPage] = useState(1);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [filters, setFilters] = useState({ device: [], mnemonic: [] });
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const { syslogTags, reload: reloadSyslogTags } = useSyslogTags(keycloak);
    const { mnemonics, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { regexes, reload: reloadRegEx } = useSyslogRegEx(keycloak);

    useEffect(() => {
        loadData(
            keycloak,
            "snmptraps",
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

export default SnmpTrapSignalsTable;