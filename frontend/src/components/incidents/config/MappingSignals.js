import React, { useState, useEffect } from 'react';
import './SignalConfigElement.css';
import Select from 'react-select';
import customStyles from '../../../components/misc/SelectStyles';
import apiClient from '../../misc/AxiosConfig';

const MappingSignals = ({ devices }) => {
    const [selectedOption, setSelectedOption] = useState(null);
    const [mappingRules, setMappingRules] = useState([]);
    const [newRule, setNewRule] = useState('');
    const [editedData, setEditedData] = useState({});
    const [mnemonics, setMnemonics] = useState([]);
    const [tagNames, setTagNames] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [alert, setAlert] = useState('');

    const [newRuleData, setNewRuleData] = useState({
        name: '',
        devices: [],
        devicesFilter: '',
        openSignalMnemonic: '',
        openSignalEvent: '',
        openSignalValue: '',
        closeSignalMnemonic: '',
        closeSignalEvent: '',
        closeSignalValue: '',
        initialSeverity: '',
        affectedEntity: [],
        description: '',
        warmUp: '',
        coolDown: '',
    });
    const [isAddingNewRule, setIsAddingNewRule] = useState(true);

    useEffect(() => {
        const fetchMappingRules = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/incidents/mappingrules/brief/');
                setMappingRules(response.data);
            } catch (error) {
                console.error('Error fetching mapping rules:', error);
                setError('Error fetching mapping rules:')
            } finally {
                setIsLoading(false);
            }
        };

        const fetchSyslogRules = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/syslogs/mnemonics/brief/');
                const mnemonicsData = response.data;
                const formattedMnemonics = mnemonicsData.map(mnemonic => ({
                    value: mnemonic.id,
                    label: mnemonic.name
                }));
                setMnemonics(formattedMnemonics);
            } catch (error) {
                console.error('Error fetching mnemonics in StatefulSyslogs:', error);
                setError('Failed to load mnemonics. Please try again later.');
            } finally {
                setIsLoading(false);
            }
        };

        const fetchTrapRules = async () => {
            try {
                const response = await apiClient.get('/syslogs/tags/tagsList/');
                const formattedTagNames = response.data.map((tagName) => ({
                    value: tagName,
                    label: tagName,
                }));
                setTagNames(formattedTagNames);
            } catch (error) {
                console.error('Error fetching tag names:', error);
            }
        };

        fetchMappingRules();
        fetchTrapRules();
        fetchSyslogRules();
    }, []);

    const handleOptionChange = (rule) => {
        setSelectedOption(rule);
        setIsAddingNewRule(false);
        setEditedData(rule); 

        apiClient.get(`/incidents/mappingrules/${rule.id}/`)
            .then((response) => {
                setNewRuleData(response.data);
                console.log('Fetched Mapping Rules Details:', response.data);
            })
            .catch((error) => {
                console.error('Error fetching Mapping Rules details:', error);
            });
    };

    const handleAddRule = () => {
        const payload = {
            name: newRuleData.name,
            devices: newRuleData.devices,
            syslogSignalRule: newRuleData.syslogSignalRule,
            trapSignalRule: newRuleData.trapSignalRule,
            initialSeverity: newRuleData.initialSeverity,
        };

        console.log("Payload:", payload); 
        apiClient.post('/incidents/mappingrules/', payload)
            .then(response => {
                console.log("Rule successfully added:", response.data);
                setNewRuleData({}); 
            })
            .catch(error => {
                console.error("Error adding rule:", error);
            });
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setEditedData({
            ...editedData,
            [name]: value, 
        });
    };


    const handleSave = async () => {
        try {
            const { id } = newRuleData;
            const response = await apiClient.put(`/incidents/mappingrules/${id}/`, newRuleData);
            setNewRule(mappingRules.map(rule => (rule.id === id ? response.data : rule)));
            setSelectedOption(response.data);
            setAlert("Tag updated successfully!");
            setNewRule({
                name: '',
                devices: [],
                syslogSignalRule: '',
                trapSignalRule: '',
                initialSeverity: '',
            });

            setIsAddingNewRule(true);
        } catch (error) {
            console.error('Error updating tag:', error);
            setAlert("Failed to update tag. Please try again.");
        }
    };

    const handleDelete = async () => {
        try {
            await apiClient.delete(`/incidents/mappingrules/${editedData.id}/`);
            setMappingRules(mappingRules.filter(rule => rule.id !== editedData.id));
            setSelectedOption(null); 
        } catch (error) {
            console.error('Error deleting rule:', error);
        }
    };

    const handleHostnameChange = (selectedOptions) => {
        const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
        setNewRuleData({
            ...newRuleData,
            devices: selectedIds,
        })
    }

    return (
        <div className="signalConfigRuleContainer">
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading stateful syslog rules. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div className="signalConfigRuleContent">
                        <div className="signalConfigRulesList">
                            <ul>
                                <li
                                    className={`button ${isAddingNewRule ? 'button-active' : ''}`}
                                    onClick={() => {
                                        setIsAddingNewRule(true);
                                        setSelectedOption(null);
                                        setNewRuleData({
                                            name: '',
                                            devices: [],
                                            syslogSignalRule: '',
                                            trapSignalRule: '',
                                            initialSeverity: '',
                                        });
                                        setEditedData({}); // Clear form or edited data
                                    }}>
                                    Add new rule
                                </li>
                                {mappingRules.map((rule) => (
                                    <li
                                        key={rule.id}
                                        className={`button ${selectedOption && selectedOption.id === rule.id ? 'button-active' : ''
                                            }`}
                                        onClick={() => handleOptionChange(rule)}
                                    >
                                        {rule.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ width: '70%', margin: '5px' }}>
                            <div className="tag-details" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, padding: '10px' }}>
                                <div style={{ height: '400px', overflowY: 'auto', padding: '8px' }}>
                                    <div style={{ marginRight: '15px' }}>
                                        <span>Name:</span>
                                        <input
                                            type="text"
                                            name="name"
                                            value={newRuleData.name}
                                            className="inputText"
                                            style={{ width: '535px' }}
                                            onChange={(e) =>
                                                setNewRuleData({ ...newRuleData, name: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', marginRight: '15px' }}>
                                        <span>Hostname:</span>
                                        <Select
                                            name="hostname"
                                            value={devices.filter(device => newRuleData.devices.includes(device.id)).map(device => ({
                                                value: device.id,
                                                label: device.hostname,
                                            }))}
                                            isMulti
                                            options={devices.map(device => ({
                                                value: device.id,
                                                label: device.hostname,
                                            }))}
                                            onChange={handleHostnameChange}
                                            styles={customStyles('540px')}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', marginRight: '15px' }}>
                                        <span>Open Signal Mnemonic:</span>
                                        <Select
                                            name="openSignalMnemonic"
                                            value={mnemonics.find(option => option.label === newRuleData.openSignalMnemonic)}
                                            isMulti={false}
                                            options={mnemonics.map(mnemonic => ({
                                                value: mnemonic.value,
                                                label: mnemonic.label,
                                            }))}
                                            onChange={(selectedOption) => {
                                                setNewRuleData({
                                                    ...newRuleData,
                                                    openSignalMnemonic: selectedOption.label
                                                });
                                            }}
                                            isLoading={isLoading}
                                            styles={customStyles('540px')}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Close Signal Mnemonic:</span>
                                        <Select
                                            name="closeSignalMnemonic"
                                            value={mnemonics.find(option => option.label === newRuleData.closeSignalMnemonic)}
                                            isMulti={false}
                                            options={mnemonics.map(mnemonic => ({
                                                value: mnemonic.value,
                                                label: mnemonic.label,
                                            }))}

                                            onChange={(selectedOption) =>
                                                setNewRuleData({ ...newRuleData, closeSignalMnemonic: selectedOption.label })}
                                            isLoading={isLoading}
                                            styles={customStyles('540px')}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </>
            )}
            {!isLoading && !error && (
                <div className="signalConfigButtonContainer">
                    {isAddingNewRule ? (
                        <>
                            <button onClick={handleAddRule} className="buttonStyles addRuleButton">
                                Add Rule
                            </button>
                            <button onClick={() => isAddingNewRule(false)}>Cancel</button>
                        </>
                    ) : (
                        selectedOption && (
                            <>
                                <button onClick={handleSave} style={{ marginRight: '10px' }} className="saveRuleButton">
                                    Save
                                </button>
                                <button
                                    onClick={handleDelete}
                                    className="buttonStyles deleteRuleButton"
                                >
                                    Delete
                                </button>
                            </>
                        )
                    )}
                </div>
            )}
        </div >
    );
};

export default MappingSignals;
