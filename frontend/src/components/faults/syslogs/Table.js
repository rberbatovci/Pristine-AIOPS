import { useState, useEffect, useRef } from 'react';
import '../../../css/SyslogDatabase.css';
import EventsTable from '../../../components/misc/EventsTable.js';  
import { useFaultData } from '../../../hooks/useFaultData';
import { NavLink, useLocation } from 'react-router-dom';

function SyslogEventTable({ currentUser, setDashboardTitle, showNotification, selectedTags = [], keycloak, startTime, endTime, selectedFilters = {} }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData();
    const [page, setPage] = useState(1);  
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);  
    const location = useLocation(); 

    useEffect(() => {
        loadData(
            keycloak,
            "syslogs",
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            { ...selectedFilters, tags: selectedTags }
        );
    }, [location.pathname, keycloak, page, startTime, endTime, selectedFilters, selectedTags, loadData]);

    const tags = [
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

    return (
        <div className="mainContainer" ref={dropdownWrapperRef} style={{ marginTop: '10px', maxWidth: '85%', paddingTop: '5px'}}>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <>
                        <div className="syslogsTableContainer">
                            <EventsTable
                                source="syslogs"
                                type="events"
                                data={eventsData}
                                totalPages={totalPages}
                                tags={selectedTags} 
                                onRowSelectChange={handleRowSelectChange}
                                page={page}
                                onPageChange={setPage}
                                selectedTags={selectedTags}
                                onTagSelectChange={handleRowSelectChange}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default SyslogEventTable;