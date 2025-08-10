import React, { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles';
import { TailSpin } from 'react-loader-spinner';

function TrapTags({ currentUser, onAdd, onDelete, onEdit, onSave }) {
    const [trapTags, setTrapTags] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState('');
    const [newTag, setNewTag] = useState({
        name: '',
        oids: [],
    });
    const [selectedTag, setSelectedTag] = useState(null);
    const [isAddNewTag, setIsAddNewTag] = useState(true);
    const [loadingState, setLoadingState] = useState(null);

    useEffect(() => {
        fetchTrapTags();
    }, []);

    const fetchTrapTags = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiClient.get('/traps/tags/');
            setTrapTags(response.data);
        } catch (err) {
            console.error('Error fetching trap tags:', err);
            setError('Failed to load trap tags.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSyncToRedis = async () => {
        try {
            await apiClient.post(`/snmptraps/tags/syncToRedis/`);
        } catch (error) {
            console.error('Error syncing regex rules:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewTag({ ...newTag, [name]: value });
    };

    const handleOidsChange = (selectedOptions) => {
        setNewTag({ ...newTag, oids: selectedOptions || [] });
    };

    const handleCreateOption = (inputValue) => {
        const newOption = { value: inputValue, label: inputValue };
        setNewTag({ ...newTag, oids: [...newTag.oids, newOption] });
    };

    const handleAdd = async () => {
        setLoadingState('adding');
        setError('');
        setAlert('');
        try {
            const oidsArray = newTag.oids.map(oid => oid.value);
            const response = await apiClient.post('/traps/tags/', { name: newTag.name, oids: oidsArray });
            setTrapTags([...trapTags, response.data]);
            setNewTag({ name: '', oids: [] });
        } catch (err) {
            console.error('Error creating trap tag:', err);
            setError('Failed to create trap tag.');
            setNewTag({
                name: '',
                oids: [],
            });
            setTimeout(() => setError(''), 3000);
        } finally {
            setLoadingState(null);
        }
    };

    const handleDelete = async (tagName) => {
        setLoadingState('deleting');
        setError('');
        try {
            await apiClient.delete(`/traps/tags/${tagName}`);
            setTrapTags(trapTags.filter(tag => tag.name !== tagName));
            if (selectedTag?.name === tagName) {
                setSelectedTag(null);
            }
            setNewTag({
                name: '',
                oids: [],
            });
        } catch (err) {
            setAlert("Failed to delete tag. Please try again.");
        } finally {
            setLoadingState(null);
        }
    };

    const handleSelectTag = async (tag) => {
        try {
            const response = await apiClient.get(`/traps/tags/${tag.name}`);
            const fullTag = response.data;

            setSelectedTag(fullTag);
            setNewTag({
                name: fullTag.name,
                oids: fullTag.oids ? fullTag.oids.map(oid => ({ value: oid, label: oid })) : [],
            });
        } catch (error) {
            console.error("Failed to fetch tag details:", error);
        }
    };

    const handleSave = async () => {
        if (!selectedTag) return;
        setLoadingState('saving');
        setError('');
        setAlert('');
        try {
            const oidsArray = newTag.oids.map(oid => oid.value);
            const response = await apiClient.put(`/traps/tags/${selectedTag.name}`, {
                oids: oidsArray
            });
            setTrapTags(prev =>
                prev.map(tag => tag.name === response.data.name ? response.data : tag)
            );
            setSelectedTag(null);
            setNewTag({ name: '', oids: [] });
        } catch (err) {
            console.error('Error updating trap tag:', err);
            setError('Failed to update trap tag.');
        } finally {
            setLoadingState(null);
        }
    };

    return (
        <div className="signalTagContainer">
            <div style={{ marginTop: '2px' }}>SNMP Trap Tag Configuration:</div>
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading trap tags...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage" style={{ color: 'red' }}>{error}</div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '240px', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', height: '250px', overflowY: 'auto' }}>
                            <ul style={{ padding: 0, listStyle: 'none', margin: 0 }}>
                                <li
                                    className={`signalTagItem ${isAddNewTag ? 'selected' : ''}`}
                                    onClick={() => {
                                        setIsAddNewTag(true);
                                        setSelectedTag(null);
                                        setNewTag({ name: '', oids: [] });
                                    }}
                                    style={{ marginBottom: '5px' }}
                                >
                                    Add New Tag
                                </li>
                                {trapTags.map((tag) => (
                                    <li
                                        key={tag.name}
                                        className={`signalTagItem ${selectedTag?.name === tag.name ? 'selected' : ''}`}
                                        onClick={() => handleSelectTag(tag)}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '5px',
                                        }}
                                    >
                                        {tag.name}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(tag.name);
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'red',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                marginLeft: '8px',
                                            }}
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', width: '400px', height: '250px' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <span>Name:</span>
                                <input
                                    type="text"
                                    name="name"
                                    value={newTag.name}
                                    className="inputText"
                                    style={{ width: '375px' }}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <span>OIDs:</span>
                                <CreatableSelect
                                    isMulti
                                    name="oids"
                                    value={newTag.oids}
                                    onChange={handleOidsChange}
                                    onCreateOption={handleCreateOption}
                                    styles={customStyles('380px')}
                                    placeholder="Type OIDs and hit Enter or Space"
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
            {
                !isLoading && !error && (
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                        {isAddNewTag ? (
                            <>

                                <button onClick={() => setIsAddNewTag(false)} className="button cancel-button">Cancel</button>

                                <button onClick={handleAdd} disabled={loadingState === 'adding'} className="button add-button">
                                    {loadingState === 'adding' ? <TailSpin height={16} width={16} color="#fff" /> : 'Add Rule'}
                                </button>
                            </>
                        ) : (
                            selectedTag && (
                                <>

                                    <button onClick={handleDelete} disabled={loadingState === 'removing'} className="button delete-button">
                                        {loadingState === 'removing' ? <TailSpin height={16} width={16} color="#fff" /> : 'Delete'}
                                    </button>
                                    <button onClick={handleSave} disabled={loadingState === 'editing'} className="button save-button">
                                        {loadingState === 'editing' ? <TailSpin height={16} width={16} color="#fff" /> : 'Save'}
                                    </button>
                                </>
                            )
                        )}
                    </div>
                )
            }
        </div>
    );
}

export default TrapTags;