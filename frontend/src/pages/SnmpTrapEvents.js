import { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import ChartView from '../components/misc/ChartView.js';  
import { useSnmpTrapTags } from '../hooks/useSnmpTrapTags'; 
import { useSnmpTrapOids } from '../hooks/useSnmpTrapOids';
import { useFaultData } from '../hooks/useFaultData';

function SnmpTrapEvents({ currentUser, setDashboardTitle, showNotification, keycloak }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData();
    const [tags, setTags] = useState([]);
    const [page, setPage] = useState(1);
    const [startTime, setStartTime] = useState(null);
    const [endTime, setEndTime] = useState(null);
    const [filters, setFilters] = useState({ device: [], mnemonic: [] });
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]); 
    const [selectedTags, setSelectedTags] = useState([]);  
    const { list: snmpTrapOids, loading: oidsLoading, loadList: reloadSnmpTrapOids } = useSnmpTrapOids(keycloak);
    const { list: snmpTrapTags, loading: snmpTrapTagsLoading, loadList: reloadSnmpTrapTags } = useSnmpTrapTags(keycloak, false);

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
        setDashboardTitle("Events Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    useEffect(() => {
        reloadSnmpTrapOids(keycloak);
        reloadSnmpTrapTags(keycloak); 
    }, []);

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
                                    dataSource="snmptraps"
                                    data={eventsData}
                                    totalPages={totalPages}
                                    tags={tags}
                                    signalSource="snmptraps"
                                    onRowSelectChange={handleRowSelectChange}
                                    page={page}
                                    onPageChange={setPage} 
                                    selectedTags={selectedTags}
                                    onTagSelectChange={setSelectedTags}
                                />
                            </div>
                        )}
                        {view === 'chart' && (
                            <div className="syslogsTableContainer"> 
                                <ChartView
                                    keycloak={keycloak}
                                    source="events"
                                    dataSource="snmptraps"
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

export default SnmpTrapEvents;