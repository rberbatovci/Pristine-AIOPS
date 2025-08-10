import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles';
import { TailSpin } from 'react-loader-spinner';

const SnmpTrapOid = ({ currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedTrapOid, setSelectedTrapOid] = useState(null);
    const [availableTags, setAvailableTags] = useState([]);
    const [selectedTagsForOid, setSelectedTagsForOid] = useState([]);
    const [updateError, setUpdateError] = useState('');
    const [onSuccesss, setOnSuccesss] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (snmpTrapOids && snmpTrapOids.length > 0 && !selectedTrapOid) {
            const randomIndex = Math.floor(Math.random() * snmpTrapOids.length);
            const randomSnmpTrapOids = snmpTrapOids[randomIndex];
            handleTrapOidSelect(randomSnmpTrapOids);
        }
    }, [snmpTrapOids]);

    const fetchSnmpTrapOids = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/traps/trapOids/');
            setSnmpTrapOids(response.data);
        } catch (err) {
            console.error('Error fetching SNMP Trap OIDs:', err);
            setError('Failed to load SNMP Trap OIDs.');
        } finally {
            setIsLoading(false);
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

    const handleSave = async () => {
        if (!selectedTrapOid) return;
        setIsSaving(true);
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
            setIsSaving(false);
        }
    };

    const filteredSnmpTrapOids = snmpTrapOids.filter(trapOid =>
        trapOid.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trapOid.oid.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="signalTagContainer">
            <div style={{ marginTop: '2px', marginBottom: '8px' }}>SNMP Trap OIDs Configuration:</div>
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading SNMP Trap OIDs. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div className="signalTagList" style={{ flex: 1, maxHeight: '300px', overflowY: 'auto', paddingBottom: '10px' }}>
                            <input
                                type="text"
                                placeholder="Search SNMP Trap OIDs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="signalSearchItem"
                                style={{ width: '220px', outline: 'none' }}
                            />
                            <ul style={{ padding: 0, listStyle: 'none', margin: 0, marginBottom: '10px' }}>
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
                        {selectedTrapOid && (
                            <div style={{ padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', padding: '10px' }}>
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
                                <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                    <span style={{ marginRight: '10px' }}>Alerting:</span>
                                    <input
                                        type="checkbox"
                                        checked={!!selectedTrapOid.alert}
                                        onChange={(e) => setSelectedTrapOid({
                                            ...selectedTrapOid,
                                            alert: e.target.checked
                                        })}
                                    />
                                    <span style={{ marginLeft: '8px' }}>
                                        {selectedTrapOid.alert ? 'True' : 'False'}
                                    </span>
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
                            </div>
                        )}
                    </div>
                </>)}

            {!isLoading && !error && selectedTrapOid && (
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    {onSuccesss ? (<div style={{ padding: '12px', borderRadius: '6px', width: '100%', background: 'var(--backgroundColor3)' }}> Mnemnic has been updated successfully</div>) : (<div><button onClick={handleSave} disabled={isSaving} style={{ marginRight: '10px' }} className="button save-button">
                        {isSaving ? <TailSpin height={16} width={16} color="#fff" /> : 'Save'}
                    </button> </div>)}

                </div>
            )}
        </div>
    );
};

export default SnmpTrapOid;