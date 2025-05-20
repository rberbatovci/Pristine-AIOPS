import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

function TrapOIDConfig({ currentUser, trapOids, oids, devices }) {
    const [selectedOption, setSelectedOption] = useState(null);
    const [editedData, setEditedData] = useState({});
    const [isAddNewTag, setIsAddNewTag] = useState(true);
    const [syslogTags, setSyslogTags] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [newSnmpTrapOid, setNewSnmpTrapOid] = useState({
        name: '',
        value: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [filteredTrapOids, setFilteredTrapOids] = useState(trapOids || []);

    console.log('Agent devices in TrapOIDConfig:', devices);
    console.log('SNMP Trap OID data in TrapOIDConfig:', trapOids);
    console.log('SNMP OID data in TrapOIDConfig:', oids);

    const handleOptionChange = (trapOid) => {
        setSelectedOption(trapOid);
        setEditedData(trapOid);
        apiClient.get(`/snmptraps/trapoid/${trapOid.name}/`)
            .then((response) => {
                setNewSnmpTrapOid(response.data);
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
            devices: [],
            devicesfilter: null,
            oids: [],
        });
    }, []);

    useEffect(() => {
        setFilteredTrapOids(
            trapOids?.filter(oid =>
                oid?.label?.toLowerCase().includes(searchTerm.toLowerCase())
            ) || []
        );
    }, [searchTerm, trapOids]);

    const handleSave = async () => {
        try {
            const { id } = newSnmpTrapOid;
            const response = await apiClient.put(`/snmptraps/trapoid/${id}/`, newSnmpTrapOid);
            setSyslogTags(syslogTags.map(tag => (tag.id === id ? response.data : tag)));
            setSelectedOption(response.data);
            setAlert("Tag updated successfully!");
            setNewSnmpTrapOid({
                name: '',
                value: '',
                devices: [],
                devicesfilter: null,
                oids: [],
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
                    <div>
                        <div style={{ marginTop: '2px' }}>Syslog Tag Configuration:</div>
                        <div className="signalConfigRuleContent" style={{ marginTop: '5px', height: '350px' }}>
                            <div style={{ width: '240px', padding: '5px' }}>
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
                                    {filteredTrapOids.map((trapOid) => (
                                        <li
                                            key={trapOid.id}
                                            className={`button ${selectedOption && selectedOption.id === trapOid.id ? 'button-active' : ''}`}
                                            onClick={() => handleOptionChange(trapOid)}
                                        >
                                            {trapOid.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>


                            {selectedOption && (
                                <div >
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
                                            name="value"
                                            value={newSnmpTrapOid.value}
                                            className="inputText"
                                            style={{ width: '375px' }}
                                            onChange={(e) => setNewSnmpTrapOid({ ...newSnmpTrapOid, value: e.target.value })}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '5px' }}>
                                        <span>SNMP OIDs:</span>
                                        <Select
                                            name="snmpOids"
                                            value={oids.filter(oid => newSnmpTrapOid.oids.includes(oid.id)).map(oid => ({
                                                value: oid.id,
                                                label: oid.label,
                                            }))}
                                            isMulti
                                            options={oids.map(oid => ({
                                                value: oid.id,
                                                label: oid.label,

                                            }))}
                                            styles={customStyles('360px')}
                                            onChange={handleSNMPOIDChange}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '5px' }}>
                                        <span>Devices:</span>
                                        <Select
                                            name="devices"
                                            value={devices.filter(device => newSnmpTrapOid.devices.includes(device.id)).map(device => ({
                                                value: device.id,
                                                label: device.label,
                                            }))}
                                            isMulti
                                            options={devices.map(device => ({
                                                value: device.id,
                                                label: device.label,

                                            }))}
                                            
                                            onChange={handleDeviceChange}
                                        />
                                    </div>
                                    {newSnmpTrapOid.devices && newSnmpTrapOid.devices.length > 0 && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', paddingLeft: '15px' }}>
                                                <label style={{ marginRight: '15px' }}>
                                                    <input
                                                        type="radio"
                                                        name="devicesfilter"
                                                        value="include"
                                                        checked={newSnmpTrapOid.devicesfilter === 'include'}
                                                        onChange={() => setNewSnmpTrapOid({ ...newSnmpTrapOid, hostnamefilter: 'include' })}
                                                    />
                                                    Include
                                                </label>
                                                <label>
                                                    <input
                                                        type="radio"
                                                        name="devicesfilter"
                                                        value="exclude"
                                                        checked={newSnmpTrapOid.devicesfilter === 'exclude'}
                                                        onChange={() => setNewSnmpTrapOid({ ...newSnmpTrapOid, hostnamefilter: 'exclude' })}
                                                    />
                                                    Exclude
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                </div>
                            )}
                        </div>
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

export default TrapOIDConfig;