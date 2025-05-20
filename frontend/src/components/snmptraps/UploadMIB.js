import React, { useState, useEffect, useRef } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import { IoMdAddCircleOutline, IoMdAddCircle } from "react-icons/io";
import { RiDeleteBin6Line } from "react-icons/ri";

const UploadMIB = ({ tags }) => {
    const [searchValue, setSearchValue] = useState('');
    const [file, setFile] = useState(null);
    const [response, setResponse] = useState(null);
    const [mibList, setMibList] = useState([]);
    const fileInputRef = useRef(null);

    const fetchMIBs = async () => {
        try {
            const response = await apiClient.get('/traps/mibs/');
            setMibList(response.data.mibs);
        } catch (error) {
            console.error('Error fetching MIB files:', error);
        }
    };

    const handleUpload = async (fileToUpload) => {
        if (!fileToUpload) return;
        const formData = new FormData();
        formData.append("file", fileToUpload);

        try {
            const res = await apiClient.post("/traps/mibs/upload/", formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setResponse(res.data);
            fetchMIBs();
        } catch (err) {
            console.error("Upload error:", err);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            handleUpload(selectedFile);
        }
    };

    const handleDelete = async (filename) => {
        try {
            await apiClient.delete(`/traps/mibs/${filename}`);
            fetchMIBs();
        } catch (err) {
            console.error(`Error deleting ${filename}:`, err);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    useEffect(() => {
        fetchMIBs();
    }, []);

    const filteredMibs = mibList.filter(mib =>
        mib.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
        <div className="signalTagContainer">
            {!tags.length && <p>Loading tags...</p>}
            {tags.length > 0 && (
                
                <div style={{
                    padding: '10px',
                    height: '350px',
                    overflowY: 'auto',
                    background: 'var(--backgroundColor3)',
                    borderRadius: '8px',
                    display: 'block'
                }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Search MIBs..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="searchTagListElement"
                            style={{
                                background: 'var(--buttonBackground)',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                outline: 'none',
                                width: '220px'
                            }}
                        />
                        <button className="iconButton" onClick={triggerFileInput}>
                            <IoMdAddCircleOutline className="defaultIcon hasFilters" />
                            <IoMdAddCircle className="hoverIcon" />
                        </button>
                        <input
                            type="file"
                            accept=".mib,.txt"
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <ul style={{ marginTop: '10px' }}>
                            {filteredMibs.map((mib, index) => (
                                <li key={index} style={{
                                    padding: '8px 12px',
                                    marginBottom: '6px',
                                    background: 'var(--buttonBackground)',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    opacity: '0.7'
                                }}>
                                    <span>{mib}</span>
                                    <button
                                        onClick={() => handleDelete(mib)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'red'
                                        }}
                                        title="Delete MIB"
                                    >
                                        <RiDeleteBin6Line />
                                    </button>
                                </li>
                            ))}
                        </ul>

                        {response && (
                            <div style={{ marginTop: '10px', color: 'green' }}>
                                Uploaded: {response.filename}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadMIB;
