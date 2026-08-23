import { useState, useEffect, useRef } from 'react';
import '../../../css/SyslogDatabase.css';
import EventsTable from '../../../components/misc/EventsTable.js'; 
import { useSyslogTags } from '../../../hooks/useSyslogTags';
import { useMnemonics } from '../../../hooks/useMnemonics';
import { useSyslogRegEx } from '../../../hooks/useSyslogRegEx';
import { useSignalData } from '../../../hooks/useSignalData';
import { NavLink, useLocation } from 'react-router-dom';

function SnmpTrapSignalTable({ currentUser, setDashboardTitle, showNotification, selectedTags = [], keycloak, startTime, endTime, selectedFilters = {} }) {
    const [view, setView] = useState('list');
    const { signalData, totalSignals, totalPages, loading, error, loadData } = useSignalData(); 
    const [page, setPage] = useState(1);  
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]); 
    const { syslogTags, reload: reloadSyslogTags } = useSyslogTags(keycloak);
    const { mnemonics, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { regexes, reload: reloadRegEx } = useSyslogRegEx(keycloak);

    console.log("Start Time in SnmpTrap Signal Table:", startTime);
    console.log("End Time in SnmpTrap Signal Table:", endTime);

    useEffect(() => {
        loadData(
            keycloak,   
            "snmptraps",
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            { ...selectedFilters, tags: selectedTags }
        );
    }, [keycloak, page, startTime, endTime, selectedFilters, selectedTags, loadData]);

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
        <div className="mainContainer" ref={dropdownWrapperRef} style={{ marginTop: '10px', maxWidth: '90%', paddingTop: '5px'}}>
            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <>
                        <div className="syslogsTableContainer">
                            <EventsTable
                                source="snmptraps"
                                type="signals"
                                keycloak={keycloak}
                                timezone={currentUser?.timezone || 'UTC'}  
                                data={signalData}
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

export default SnmpTrapSignalTable;