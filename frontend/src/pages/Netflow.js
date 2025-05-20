import React, { useState, useEffect, useRef } from 'react';
import '../css/SyslogDatabase.css';
import EventsTable from '../components/misc/EventsTable.js';
import { BsArrowLeftCircle, BsArrowRightCircle, BsMenuButtonFill } from "react-icons/bs";
import { RiAddCircleLine, RiAddCircleFill } from "react-icons/ri";
import InjectSyslogs from '../components/syslogs/InjectSyslogs.js';
import { IoMdRefresh, IoMdRefreshCircle } from "react-icons/io";
import apiClient from '../components/misc/AxiosConfig.js';
import { ButtonToolbar } from 'rsuite';

function Netflow({ currentUser }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [dropdowns, setDropdowns] = useState({
        syslogTagsConfig: { visible: false, position: { x: 0, y: 0 } },
    });
    const [initialColumns, setInitialColumns] = useState([
        'source_addr',
        'source_port',
        'dest_addr',
        'dest_port',
    ]);
    const [syslogs, setSyslogs] = useState([]);
    const [devices, setDevices] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [syslogsPerPage, setSyslogsPerPage] = useState(() => {
        const savedEntries = localStorage.getItem('entriesPerPage');
        return savedEntries ? JSON.parse(savedEntries) : 10;
    });
    const [filterParams, setFilterParams] = useState([]);
    const [totalEntries, setTotalEntries] = useState(false);
    const [selectedTimeRange, setSelectedTimeRange] = useState({
        startDate: new Date(new Date().getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
        endDate: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000))
    });
    const [isCustomRangeVisible, setIsCustomRangeVisible] = useState(true);
    const downloadRef = useRef(null);
    const [reloadActive, setReloadActive] = useState(false);

    const handleButtonClick = (event, dropdownKey) => {
    };

    useEffect(() => {
        loadSyslogs();
    }, []);


    const loadSyslogs = (filters = {}) => {
        setSyslogs(null);
        setLoading(true);
    
        apiClient
            .get('/netflow/')
            .then(response => {
                let results = [];
                if (response.data && response.data.results) {
                    results = response.data.results.map(item => item._source || item); // Fallback if no _source
                } else if (response.data && Array.isArray(response.data)) {
                    results = response.data.map(item => item._source || item);
                } else {
                    console.warn('Unexpected response data structure:', response.data);
                }
                setSyslogs(results);
                setTotalEntries(response.data ? response.data.count : 0); // Handle potential absence of count
            })
            .catch(error => {
                console.error('Error fetching syslogs:', error);
                setError('An error occurred while fetching data.');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    const prevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };


    const handleSyslogsPerPageChange = (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) {
            setSyslogsPerPage(value);
            setCurrentPage(1);
        }
    };

    const totalPages = Math.ceil(totalEntries / syslogsPerPage);

    const nextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            console.log('Print current page: ', currentPage)
        }
    };

    const handleRowSelectChange = (newSelectedRows) => {
       
    };


    return (
        <div className="mainContainer">
            <div className="mainContainerHeader">
                <h2 className="mainContainerTitle">Syslog Database</h2>
                <div className="mainContainerButtons">
                    <div className="headerButtons">
                        {currentUser.is_staff && (
                            <>
                                <button>
                                    <RiAddCircleLine className="defaultIcon" />
                                    <RiAddCircleFill className="hoverIcon" />
                                </button>
                            </>
                        )}
                        <button
                            className="iconButton"
                            onClick={() => setReloadActive(!reloadActive)}
                        >
                            <IoMdRefresh className="defaultIcon" />
                            <IoMdRefreshCircle className="hoverIcon" />
                        </button>

                    </div>
                </div>
            </div>

            <div className="mainContainerContent">
                {loading && <div className="loadingMessage">Loading...</div>}
                {error && <div className="errorMessage">{error}</div>}
                {!loading && !error && (
                    <div className="syslogsTableContainer">
                         <EventsTable
                            currentUser={currentUser}
                            data={syslogs}
                            columns={initialColumns}
                            signalSource="Syslogs"
                            onDownload={(downloadFn) => (downloadRef.current = downloadFn)}
                            onRowSelectChange={handleRowSelectChange}
                        /> 
                    </div>
                )}
                <div className="paginationContainer">
                    <div onClick={prevPage} style={{ cursor: 'pointer', marginLeft: '10px' }} disabled={currentPage === 1 || loading}>
                        <BsArrowLeftCircle /> Previous
                    </div>
                    <div>
                        <label htmlFor="syslogsPerPage">Syslogs Per Page:</label>
                        <input
                            type="number"
                            id="syslogsPerPage"
                            value={syslogsPerPage}
                            onChange={handleSyslogsPerPageChange}
                            min="1"
                        />
                    </div>
                    <div>
                        Page {currentPage} of {totalPages} | Total Entries: {totalEntries}
                    </div>
                    <div onClick={nextPage} style={{ cursor: 'pointer', marginRight: '10px', }} disabled={currentPage === totalPages || loading}>
                        Next <BsArrowRightCircle />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Netflow;