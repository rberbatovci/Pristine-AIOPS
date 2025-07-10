import React, { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles'; // Assuming you have custom styles

function TrapTags({ currentUser, onAdd, onDelete, onEdit, onSave }) {
    const [trapTags, setTrapTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newTag, setNewTag] = useState({
        name: '',
        oids: [], // OIDs will now be an array of { value: string, label: string }
    });
    const [selectedTag, setSelectedTag] = useState(null);
    const [isAddNewTag, setIsAddNewTag] = useState(true);

    useEffect(() => {
        fetchTrapTags();
    }, []);

    const fetchTrapTags = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.get('/traps/tags/');
            setTrapTags(response.data);
        } catch (err) {
            console.error('Error fetching trap tags:', err);
            setError('Failed to load trap tags.');
        } finally {
            setLoading(false);
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

    const handleAddTag = async () => {
        setLoading(true);
        setError('');
        try {
            const oidsArray = newTag.oids.map(oid => oid.value);
            const response = await apiClient.post('/traps/tags/', { name: newTag.name, oids: oidsArray });
            setTrapTags([...trapTags, response.data]);
            setNewTag({ name: '', oids: [] }); // Clear input fields
        } catch (err) {
            console.error('Error creating trap tag:', err);
            setError('Failed to create trap tag.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTag = async (tagName) => {
        if (!window.confirm(`Are you sure you want to delete "${tagName}"?`)) return;
        setLoading(true);
        setError('');
        try {
            await apiClient.delete(`/traps/tags/${tagName}`);
            setTrapTags(trapTags.filter(tag => tag.name !== tagName));
            if (selectedTag?.name === tagName) {
                setSelectedTag(null);
            }
        } catch (err) {
            console.error('Error deleting trap tag:', err);
            setError(`Failed to delete tag "${tagName}".`);
        } finally {
            setLoading(false);
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

    const handleSaveTag = async () => {
        if (!selectedTag) return;

        setLoading(true);
        setError('');
        try {
            const oidsArray = newTag.oids.map(oid => oid.value);
            const response = await apiClient.put(`/traps/tags/${selectedTag.name}`, {
                oids: oidsArray
            });
            // Update the trapTags list locally
            setTrapTags(prev =>
                prev.map(tag => tag.name === response.data.name ? response.data : tag)
            );
            setSelectedTag(null);
            setNewTag({ name: '', oids: [] });
        } catch (err) {
            console.error('Error updating trap tag:', err);
            setError('Failed to update trap tag.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signalTagContainer">
            <div style={{ marginTop: '2px' }}>SNMP Trap Tag Configuration:</div>
            {loading && <div className="signalConfigRuleMessage">Loading trap tags...</div>}
            {error && <div className="signalConfigRuleMessage" style={{ color: 'red' }}>{error}</div>}
            {!loading && (
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ width: '240px', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', height: '350px', overflowY: 'auto' }}>
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
                                            handleDeleteTag(tag.name);
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
                    <div style={{ padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', width: '400px', height: '150px' }}>
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
                        <div className="signalConfigButtonContainer">
                            <button onClick={handleSyncToRedis} className="addRuleButton">
                                Sync to Redis
                            </button>
                            {selectedTag ? (
                                <button
                                    className="saveRuleButton"
                                    onClick={handleSaveTag}
                                    disabled={loading || !newTag.name.trim()}
                                >
                                    Save Tag
                                </button>
                            ) : (

                                <button
                                    className="addRuleButton"
                                    onClick={handleAddTag}
                                    disabled={loading || !newTag.name.trim()}
                                >
                                    Add Tag
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TrapTags;