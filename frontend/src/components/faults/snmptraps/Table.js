import { useState, useEffect, useRef } from 'react';
import '../../../css/SyslogDatabase.css';
import EventsTable from '../../../components/misc/EventsTable.js';   
import { useFaultData } from '../../../hooks/useFaultData';
import { NavLink, useLocation } from 'react-router-dom';

function SnmpTrapEventTable({ currentUser, setDashboardTitle, showNotification, selectedTags = [], keycloak, startTime, endTime, selectedFilters = {} }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData(); 
    const [page, setPage] = useState(1);  
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]); 
    const location = useLocation(); 

    useEffect(() => {
        loadData(
            keycloak,
            "snmptraps",
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            { ...selectedFilters, tags: selectedTags }
        );
    }, [location.pathname, keycloak, page, startTime, endTime, selectedFilters, selectedTags, loadData]);

    const tags = [
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'Device', value: 'device' },
        { label: 'System Uptime', value: 'sysUpTime' },
        { label: 'SNMP Trap OID', value: 'snmpTrapOid' },
        { label: 'Content', value: 'content' }, 
    ]; 
    
    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    useEffect(() => {
        setDashboardTitle("Events Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);
  
    return (
        <div className="mainContainer" ref={dropdownWrapperRef} style={{ marginTop: '10px', maxWidth: '90%', paddingTop: '5px'}}>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <>
                        <div className="syslogsTableContainer">
                            <EventsTable
                                source="snmptraps"
                                type="events"
                                keycloak={keycloak}
                                timezone={currentUser?.timezone || 'UTC'} 
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

export default SnmpTrapEventTable;