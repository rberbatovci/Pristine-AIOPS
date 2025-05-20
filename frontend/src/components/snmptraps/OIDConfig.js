import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

function OIDConfig({ currentUser, trapOids, oids, devices }) {
    const [selectedOption, setSelectedOption] = useState(null);
    const [editedData, setEditedData] = useState({});
    const [isAddNewTag, setIsAddNewTag] = useState(true);
    const [syslogTags, setSyslogTags] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [newSnmpTrapOid, setNewSnmpTrapOid] = useState({
        name: '',
        value: '',
        oid: '',
    });
    const [selectedOid, setSelectedOid] = useState({
        name: '',
        value: '',
        oid: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filteredTrapOids, setFilteredTrapOids] = useState(trapOids || []);
    const [filteredOids, setFilteredOids] = useState(oids || []);
    console.log('Agent devices in TrapOIDConfig:', devices);
    console.log('SNMP Trap OID data in TrapOIDConfig:', trapOids);
    console.log('SNMP OID data in TrapOIDConfig:', oids);

    const handleOidSelection = (oid) => {
        setLoading(true);
        setError('');
        setAlert('');
        setSelectedOption(oid);
        setEditedData(oid);
        apiClient.get(`/snmptraps/oid/${oid.id}/`)
            .then((response) => {
                setNewSnmpTrapOid(response.data);
                setSelectedOid(response.data);
                console.log('Fetched Syslog Tag Details:', response.data);
            })
            .catch((error) => {
                console.error('Error fetching syslog tag details:', error);
            });
    };

    useEffect(() => {
        setSelectedOption(null);
        setNewSnmpTrapOid({
            name: '',
            value: '',
            oid: '',
        });
        setSelectedOid({
            name: '',
            oid: '',
            tag: '',
        })
    }, []);

    const handleSave = async () => {
        try {
            const { id } = newSnmpTrapOid;
            const response = await apiClient.put(`/snmptraps/oid/${id}/`, newSnmpTrapOid);
            setSyslogTags(syslogTags.map(tag => (tag.id === id ? response.data : tag)));
            setSelectedOption(response.data);
            setAlert("Tag updated successfully!");
            setNewSnmpTrapOid({
                name: '',
                value: '',
                tag: '',
            });
            setIsAddNewTag(true);
        } catch (error) {
            console.error('Error updating tag:', error);
            setAlert("Failed to update tag. Please try again.");
        }
    };

    const handleDelete = async () => {
        try {
            await apiClient.delete(`/syslogs/tags/${editedData.id}/`);
            setSyslogTags(syslogTags.filter(tag => tag.id !== editedData.id));
            setSelectedOption(null);
            setAlert("Tag deleted successfully!");
        } catch (error) {
            console.error('Error deleting tag:', error);
            setAlert("Failed to delete tag. Please try again.");
        }
    };

    const handleDeleteAll = async () => {
        try {
            await apiClient.delete('/snmptraps/trapoid/'); // Endpoint to delete all trap OIDs
            setFilteredTrapOids([]); // Clear the list
            setSelectedOption(null); // Clear the selected option
            setAlert("All SNMP Trap OIDs deleted successfully!");
        } catch (error) {
            console.error('Error deleting all trap OIDs:', error);
            setAlert("Failed to delete all trap OIDs. Please try again.");
        }
    };

    const handleSNMPOIDChange = (selectedOptions) => {
        const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
        setNewSnmpTrapOid({
            ...newSnmpTrapOid,
            snmpOids: selectedIds,
        });
    };

    const handleDeviceChange = (selectedOptions) => {
        const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
        setNewSnmpTrapOid({
            ...newSnmpTrapOid,
            devices: selectedIds,
        });
    };

    return (
        <div className="signalTagContainer">
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading stateful syslog rules. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : alert ? (
                <div className="signalConfigRuleMessage">{alert}</div>
            ) : (
                <>
                        <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '240px', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px' }}>
                                <input
                                    type="text"
                                    placeholder="Search or Add New Rule..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="inputText"
                                    style={{ width: '200px', marginBottom: '5px' }}
                                />
                                <ul style={{
                                    padding: 0, listStyle: 'none', margin: 0, height: '310px',
                                    maxHeight: '100%',
                                    overflowY: 'auto'
                                }}>
                                    {Array.isArray(oids) && oids.map((oid) => (
                                        <li
                                            key={oid.id}
                                            className={`button ${selectedOption && selectedOption.id === oid.id ? 'button-active' : ''}`}
                                            onClick={() => handleOidSelection(oid)}
                                        >
                                            {oid.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>


                            {selectedOption && (
                                <div style={{ padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px' }}>
                                    <div style={{ marginBottom: '5px', marginTop: '-10px' }}>
                                        <span>Name:</span>
                                        <input
                                            type="text"
                                            name="name"
                                            value={newSnmpTrapOid.name}
                                            className="inputText"
                                            style={{ width: '375px' }}
                                            onChange={(e) => setNewSnmpTrapOid({ ...newSnmpTrapOid, name: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '5px' }}>
                                        <span>Value:</span>
                                        <input
                                            type="text"
                                            name="oid"
                                            value={newSnmpTrapOid.oid}
                                            className="inputText"
                                            style={{ width: '375px' }}
                                            onChange={(e) => setNewSnmpTrapOid({ ...newSnmpTrapOid, oid: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '5px' }}>
                                        <span>Tag:</span>
                                        <input
                                            type="text"
                                            name="tag"
                                            value={newSnmpTrapOid.tag}
                                            className="inputText"
                                            style={{ width: '375px' }}
                                            onChange={(e) => setNewSnmpTrapOid({ ...newSnmpTrapOid, tag: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                </>
            )}
            {
                !isLoading && !error && selectedOption && (
                    <div className="signalConfigButtonContainer">
                        <button onClick={handleSave} style={{ marginRight: '10px' }} className="buttonStyles saveRuleButton">
                            Save
                        </button>
                        <button
                            onClick={handleDelete}
                            className="buttonStyles deleteRuleButton"
                        >
                            Delete
                        </button>
                    </div>
                )
            }
        </div>
    );
}

export default OIDConfig;