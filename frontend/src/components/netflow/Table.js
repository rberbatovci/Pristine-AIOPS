import { useState, useEffect, useRef } from 'react';
import '../../css/SyslogDatabase.css';
import EventsTable from '../../components/misc/EventsTable.js'; 
import { useSyslogTags } from '../../hooks/useSyslogTags';
import { useMnemonics } from '../../hooks/useMnemonics';
import { useSyslogRegEx } from '../../hooks/useSyslogRegEx';
import { useFaultData } from '../../hooks/useFaultData';
import { NavLink, useLocation } from 'react-router-dom';

function TrafficTable({ currentUser, setDashboardTitle, showNotification, keycloak, startTime, endTime }) {
    const [view, setView] = useState('list');
    const { eventsData, totalEvents, totalPages, loading, error, loadData } = useFaultData(); 
    const [page, setPage] = useState(1); 
    const [filters, setFilters] = useState({ device: [], mnemonic: [] });
    const dropdownWrapperRef = useRef(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const { syslogTags, reload: reloadSyslogTags } = useSyslogTags(keycloak);
    const { mnemonics, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { regexes, reload: reloadRegEx } = useSyslogRegEx(keycloak);

    console.log("Start Time in Traffic Events Table:", startTime);
    console.log("End Time in Traffic Events Table:", endTime);

    useEffect(() => {
        loadData(
            keycloak,
            "netflow",
            page,
            startTime?.toISOString(),
            endTime?.toISOString(),
            { ...filters, tags: selectedTags }
        );
    }, [keycloak, page, startTime, endTime, filters, selectedTags, loadData]);
  
    const tags = [
        { label: 'Timestamp', value: 'timestamp' },
        { label: 'Device', value: 'device' },
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Destination IP', value: 'dest_ip' },
        { label: 'Destination Port', value: 'dest_port' },
        { label: 'Protocol', value: 'protocol' },
        { label: 'Input Interface', value: 'input_if' },
        { label: 'Output Interface', value: 'output_if' },
        { label: 'Bytes', value: 'bytes' },
        { label: 'Packets', value: 'packets' },
    ];

    const handleRowSelectChange = (newSelectedRows) => {
        setSelectedRows(newSelectedRows);
    };

    useEffect(() => {
        setDashboardTitle("Traffic Dashboard");
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

export default TrafficTable;