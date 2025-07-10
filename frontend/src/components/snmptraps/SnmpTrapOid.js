import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles'; // Assuming you have custom styles

const SnmpTrapOid = ({ currentUser }) => {
    const [searchValue, setSearchValue] = useState('');
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTrapOid, setSelectedTrapOid] = useState(null);
    const [availableTags, setAvailableTags] = useState([]);
    const [selectedTagsForOid, setSelectedTagsForOid] = useState([]);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');

    const fetchSnmpTrapOids = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/traps/trapOids/');
            setSnmpTrapOids(response.data);
        } catch (err) {
            console.error('Error fetching SNMP Trap OIDs:', err);
            setError('Failed to load SNMP Trap OIDs.');
        } finally {
            setLoading(false);
        }
    };

    const fetchTrapTags = async () => {
        try {
            const response = await apiClient.get('/traps/tags/');
            const tagsOptions = response.data.map(tag => ({ value: tag.name, label: tag.name }));
            setAvailableTags(tagsOptions);
        } catch (error) {
            console.error('Error fetching trap tags:', error);
        }
    };

    const handleSyncToRedis = async () => {
        try {
            await apiClient.post(`/snmptraps/snmpTrapOids/syncToRedis/`);
        } catch (error) {
            console.error('Error syncing regex rules:', error);
        }
    };


    useEffect(() => {
        fetchSnmpTrapOids();
        fetchTrapTags();
    }, []);

    useEffect(() => {
        if (selectedTrapOid && selectedTrapOid.tags) {
            setSelectedTagsForOid(selectedTrapOid.tags.map(tag => ({ value: tag, label: tag })));
        } else {
            setSelectedTagsForOid([]);
        }
    }, [selectedTrapOid]);

    const handleTrapOidSelect = async (trapOid) => {
        try {
            const response = await apiClient.get(`/traps/trapOids/${trapOid.name}/`);
            const fetchedTrapOid = response.data;
            setSelectedTrapOid(fetchedTrapOid);
        } catch (err) {
            console.error('Error fetching selected trap OID:', err);
            setError('Failed to load selected SNMP Trap OID.');
        }
    };

    const handleTagsChange = (selectedOptions) => {
        setSelectedTagsForOid(selectedOptions);
    };

    const handleUpdateTrapOid = async () => {
        if (!selectedTrapOid) return;
        setIsUpdating(true);
        setUpdateError('');
        try {
            const tagNames = selectedTagsForOid.map(option => option.value);
            const response = await apiClient.patch(`/traps/trapOids/${selectedTrapOid.name}`, {
                ...selectedTrapOid,
                tags: tagNames,
            });
            // Update the local state to reflect the changes
            setSnmpTrapOids(snmpTrapOids.map(oid =>
                oid.id === selectedTrapOid.id ? response.data : oid
            ));
            setSelectedTrapOid(response.data);
            // Optionally show a success message
        } catch (err) {
            console.error('Error updating SNMP Trap OID:', err);
            setUpdateError('Failed to update SNMP Trap OID tags.');
        } finally {
            setIsUpdating(false);
        }
    };

    const filteredSnmpTrapOids = snmpTrapOids.filter(trapOid =>
        trapOid.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        trapOid.oid.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
        <div className="signalTagContainer" style={{ display: 'flex' }}>
            <div style={{ flex: 1, marginRight: '20px' }}> {/* Left side */}
                {loading && <p>Loading SNMP Trap OIDs...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                {!loading && !error && Array.isArray(snmpTrapOids) && snmpTrapOids.length === 0 && (
                    <p>No SNMP Trap OIDs found.</p>
                )}
                {!loading && !error && Array.isArray(snmpTrapOids) && snmpTrapOids.length > 0 && (
                    <div style={{
                        padding: '10px',
                        height: '350px',
                        overflowY: 'auto',
                        background: 'var(--backgroundColor3)',
                        borderRadius: '8px',
                        display: 'block',
                        width: '250px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Search SNMP Trap OIDs..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="searchTagListElement"
                                style={{
                                    background: 'var(--buttonBackground)',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    border: 'none',
                                    outline: 'none',
                                    width: '100%',
                                }}
                            />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            <ul style={{ marginTop: '10px', listStyleType: 'none', padding: 0 }}>
                                {filteredSnmpTrapOids.map((trapOid, index) => (
                                    <li
                                        key={index}
                                        className={`signalTagItem ${selectedTrapOid && selectedTrapOid.id === trapOid.id ? 'selected' : ''}`}
                                        onClick={() => handleTrapOidSelect(trapOid)}
                                    >
                                        {trapOid.name} ({trapOid.oid})
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
            {selectedTrapOid && (
                <div style={{ padding: '14px', background: 'var(--backgroundColor3)', color: 'var(--textColor)', borderRadius: '8px', height: '280px', overflowY: 'auto' }}>
                    <div style={{ marginBottom: '10px' }}>
                        <span>Name:</span>
                        <input
                            type="text"
                            name="name"
                            value={selectedTrapOid?.name || ''}
                            className="inputText"
                            style={{ width: '325px' }}
                            readOnly
                        />
                    </div>
                    <div style={{ marginBottom: '10px' }}>
                        <span>Label:</span>
                        <input
                            type="text"
                            name="label"
                            value={selectedTrapOid?.label || ''}
                            className="inputText"
                            style={{ width: '325px' }}
                            readOnly
                        />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                        <span>Tags:</span>
                        <Select
                            isMulti
                            name="tags"
                            value={selectedTagsForOid}
                            options={availableTags}
                            onChange={handleTagsChange}
                            styles={customStyles('330px')}
                            placeholder="Select tags"
                        />
                    </div>
                    {updateError && <p style={{ color: 'red' }}>{updateError}</p>}
                    <button onClick={handleSyncToRedis} className="addRuleButton">
                        Sync to Redis
                    </button>
                    <button
                        onClick={handleUpdateTrapOid}
                        disabled={isUpdating}
                        className="saveRuleButton"
                    >
                        {isUpdating ? 'Updating...' : 'Update Tags'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SnmpTrapOid;