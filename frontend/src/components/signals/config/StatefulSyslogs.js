import React, { useState, useEffect } from 'react';
import './SignalConfigElement.css';
import Select from 'react-select';
import customStyles from '../../misc/SelectStyles';
import apiClient from '../../misc/AxiosConfig';

const StatefulSyslogs = ({ devices, mnemonics }) => {
    const [selectedOption, setSelectedOption] = useState(null);
    const [syslogRules, setSyslogRules] = useState([]);
    const [newRule, setNewRule] = useState('');
    const [editedData, setEditedData] = useState({});
    const [tagNames, setTagNames] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [alert, setAlert] = useState('');

    const [newRuleData, setNewRuleData] = useState({
        name: '',
        devices: [],
        devicesFilter: '',
        opensignalmnemonic: '',
        opensignaltag: '',
        opensignalvalue: '',
        closesignalmnemonic: '',
        closesignaltag: '',
        closesignalvalue: '',
        initialseverity: '',
        affectedentity: [],
        description: '',
        warmup: '',
        cooldown: '',
    });
    const [isAddingNewRule, setIsAddingNewRule] = useState(true);

    useEffect(() => {
        const fetchSyslogRules = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/syslogs/statefulrules/brief/');
                setSyslogRules(response.data);
            } catch (error) {
                console.error('Error fetching stateful syslog rules:', error);
                setError('Error fetching stateful syslog rules:')
            } finally {
                setIsLoading(false);
            }
        };

        const fetchTagNames = async () => {
            try {
                const response = await apiClient.get('/syslogs/tags/');
                const formattedTagNames = response.data.map((tag) => ({
                    value: tag.name,
                    label: tag.name,
                }));
                setTagNames(formattedTagNames);
            } catch (error) {
                console.error('Error fetching tag names:', error);
            }
        };

        fetchSyslogRules();
        fetchTagNames();
    }, []);

    const handleOptionChange = (rule) => {
        setSelectedOption(rule);
        setIsAddingNewRule(false);
        setEditedData(rule);  // Set the selected rule as the editable data

        // Fetch detailed data for the selected tag
        apiClient.get(`/syslogs/statefulrules/${rule.name}/`)
            .then((response) => {
                // Set the fetched data to newSyslogTag state
                setNewRuleData(response.data);
                console.log('Fetched Syslog Tag Details:', response.data);
            })
            .catch((error) => {
                console.error('Error fetching syslog tag details:', error);
            });
    };

    const handleAddRule = () => {
        const payload = {
            name: newRuleData.name,
            devices: newRuleData.devices,
            devicesFilter: newRuleData.devicesFilter,
            opensignalmnemonic: newRuleData.opensignalmnemonic,
            opensignaltag: newRuleData.opensignaltag,
            opensignalvalue: newRuleData.opensignalvalue,
            closesignalmnemonic: newRuleData.closesignalmnemonic,
            closesignaltag: newRuleData.closesignaltag,
            closesignalvalue: newRuleData.closesignalvalue,
            initialseverity: newRuleData.initialseverity,
            affectedentity: newRuleData.affectedentity,
            description: newRuleData.description,
            warmup: newRuleData.warmup,
            cooldown: newRuleData.cooldown
        };

        console.log("Payload:", payload);  // For debugging

        // Use apiClient to send the POST request
        apiClient.post('/syslogs/statefulrules/', payload)
            .then(response => {
                console.log("Rule successfully added:", response.data);
                // Reset form or provide feedback to the user
                setNewRuleData({}); // Reset the form data
                // Additional success handling if needed
            })
            .catch(error => {
                console.error("Error adding rule:", error);
                // Handle error feedback to the user if needed
            });
    };

    // Handle changes in the editable inputs
    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setEditedData({
            ...editedData,
            [name]: value,  // Update the changed field
        });
    };

    const handleDelete = async () => {
        try {
            await apiClient.delete(`/syslogs/statefulrules/${selectedOption.name}/`);
            setSyslogRules(syslogRules.filter(rule => rule.name !== selectedOption.name));
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
        <div className="signalTagContainer">
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading stateful syslog rules. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ width: '270px', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px' }}>
                            <ul style={{ padding: 0, listStyle: 'none'}}>
                                <li
                                    className={`signalTagItem ${isAddingNewRule ? 'selected' : ''}`}
                                    onClick={() => {
                                        setIsAddingNewRule(true);
                                        setSelectedOption(null);
                                        setNewRuleData({
                                            name: '',
                                            devices: [],
                                            devicesFilter: '',
                                            mnemonic: [],
                                            opensignalmnemonic: '',
                                            opensignaltag: '',
                                            opensignalvalue: '',
                                            closesignalmnemonic: '',
                                            closesignaltag: '',
                                            closesignalvalue: '',
                                            initialseverity: '',
                                            affectedentity: [],
                                            description: '',
                                            warmup: '',
                                            cooldown: '',
                                        });
                                        setEditedData({}); // Clear form or edited data
                                    }}>
                                    Add new rule
                                </li>
                                {syslogRules.map((rule) => (
                                    <li
                                        key={rule.id}
                                        className={`signalTagItem ${selectedOption && selectedOption.id === rule.id ? 'selected' : ''
                                            }`}
                                        onClick={() => handleOptionChange(rule)}
                                    >
                                        {rule.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ width: '67%', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px', color: 'var(--textColor)' }}>
                            {/* Name Field */}
                            <div style={{ height: '360px', overflowY: 'auto', padding: '8px' }}>
                                <div style={{ marginRight: '15px' }}>
                                    <span>Name:</span>
                                    <input
                                        type="text"
                                        name="name"
                                        value={newRuleData.name}
                                        className="inputText"
                                        style={{ width: '500px' }}
                                        onChange={(e) =>
                                            setNewRuleData({ ...newRuleData, name: e.target.value })
                                        }
                                    />
                                </div>
                                {/* Hostname Field */}
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
                                        styles={customStyles('505px')}
                                    />
                                </div>
                                {/* Hostname Filter */}
                                {newRuleData.devices && newRuleData.devices.length > 0 && (
                                    <div className="tag-detail-row">
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', paddingLeft: '15px' }}>
                                                <label style={{ marginRight: '15px' }}>
                                                    <input
                                                        type="radio"
                                                        name="devicesFilter"
                                                        value="include"
                                                        checked={newRuleData.devicesFilter === 'include'}
                                                        onChange={() => setNewRuleData({ ...newRuleData, devicesFilter: 'include' })}
                                                    />
                                                    Include
                                                </label>
                                                <label>
                                                    <input
                                                        type="radio"
                                                        name="devicesFilter"
                                                        value="exclude"
                                                        checked={newRuleData.newRuleData === 'exclude'}
                                                        onChange={() => setNewRuleData({ ...newRuleData, devicesFilter: 'exclude' })}
                                                    />
                                                    Exclude
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div style={{ marginTop: '5px', marginRight: '15px' }}>
                                    <span>Open Signal Mnemonic:</span>
                                    <Select
                                        name="opensignalmnemonic "
                                        // Find the mnemonic by its name from newRuleData and set the default value
                                        value={mnemonics.find(option => option.label === newRuleData.opensignalmnemonic)}
                                        isMulti={false}
                                        options={mnemonics.map(mnemonic => ({
                                            value: mnemonic.value,
                                            label: mnemonic.label,
                                        }))}
                                        onChange={(selectedOption) => {
                                            setNewRuleData({
                                                ...newRuleData,
                                                opensignalmnemonic: selectedOption.label // Use name as the value
                                            });
                                        }}
                                        isLoading={isLoading}
                                        styles={customStyles('505px')}
                                    />

                                </div>
                                {/* SNMP Trap OID */}
                                <div style={{ marginTop: '5px', display: 'flex' }}>
                                    <div>
                                        <span>Open Signal Event:</span>
                                        <Select
                                            name="opensignaltag"
                                            value={tagNames.find(option => option.value === newRuleData.opensignaltag) || null}
                                            options={tagNames}
                                            onChange={(selectedOption) =>
                                                setNewRuleData({ ...newRuleData, opensignaltag: selectedOption ? selectedOption.value : null })
                                            }
                                            styles={customStyles('243px')}
                                            isMulti={false} // Single-select
                                        />
                                    </div>
                                    {/* SNMP Trap OID */}
                                    <div style={{ marginLeft: '13px' }}>
                                        <span>Open signal value:</span>
                                        <input
                                            type="text"
                                            name="opensignalvalue"
                                            value={newRuleData.opensignalvalue}
                                            className="inputText"
                                            onChange={(e) =>
                                                setNewRuleData({ ...newRuleData, opensignalvalue: e.target.value })
                                            }
                                            style={{ width: '243px' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ marginTop: '5px' }}>
                                    <span>Close Signal Mnemonic:</span>
                                    <Select
                                        name="closesignalmnemonic  "
                                        // Find the mnemonic by its name from newRuleData and set the default value
                                        value={mnemonics.find(option => option.label === newRuleData.closesignalmnemonic)}
                                        isMulti={false}
                                        options={mnemonics.map(mnemonic => ({
                                            value: mnemonic.value,
                                            label: mnemonic.label,
                                        }))}

                                        onChange={(selectedOption) =>
                                            setNewRuleData({ ...newRuleData, closesignalmnemonic: selectedOption.label })}
                                        isLoading={isLoading}
                                        styles={customStyles('505px')}
                                    />
                                </div>
                                {/* SNMP Trap OID */}
                                <div style={{ marginTop: '5px', display: 'flex' }}>
                                    <div>
                                        <span>Close Signal Event:</span>
                                        <Select
                                            name="closesignaltag"
                                            value={tagNames.find(option => option.value === newRuleData.closesignaltag) || null}
                                            options={tagNames}
                                            onChange={(selectedOption) =>
                                                setNewRuleData({ ...newRuleData, closesignaltag: selectedOption ? selectedOption.value : null })
                                            }
                                            styles={customStyles('243px')}
                                            isMulti={false} // Single-select
                                        />
                                    </div>
                                    {/* SNMP Trap OID */}
                                    <div style={{ marginLeft: '13px' }}>
                                        <span>Close signal value:</span>
                                        <input
                                            type="text"
                                            name="closesignalvalue"
                                            value={newRuleData.closesignalvalue}
                                            className="inputText"
                                            onChange={(e) =>
                                                setNewRuleData({ ...newRuleData, closesignalvalue: e.target.value })
                                            }
                                            style={{ width: '243px' }}
                                        />
                                    </div>
                                </div>
                                {/* SNMP Trap OID */}
                                <div style={{ marginTop: '5px' }}>
                                    <span>Affected Entities:</span>
                                    <Select
                                        name="affectedentity"
                                        value={tagNames.filter((tag) => newRuleData.affectedentity.includes(tag.value))}
                                        options={tagNames}
                                        onChange={(selectedOptions) =>
                                            setNewRuleData({
                                                ...newRuleData,
                                                affectedentity: selectedOptions ? selectedOptions.map(option => option.value) : []
                                            })
                                        }
                                        styles={customStyles('505px')}
                                        isMulti
                                    />
                                </div>
                                {/* SNMP Trap OID */}
                                <div style={{ marginTop: '5px' }}>
                                    <span>Initial Severity:</span>
                                    <Select
                                        name="initialseverity"
                                        value={{ label: newRuleData.initialseverity, value: newRuleData.initialseverity }}
                                        options={[
                                            { label: "Low", value: "low" },
                                            { label: "Medium", value: "medium" },
                                            { label: "High", value: "high" }
                                        ]}
                                        onChange={(selectedOption) =>
                                            setNewRuleData({ ...newRuleData, initialseverity: selectedOption.value })}
                                        styles={customStyles('505px')}
                                        isMulti={false} // Single-select
                                    />
                                </div>
                                {/* SNMP Trap OID */}
                                <div style={{ marginTop: '5px' }}>
                                    <span>Description:</span>
                                    <input
                                        type="text"
                                        name="description"
                                        value={newRuleData.description}
                                        className="inputText"
                                        style={{ width: '500px' }}
                                        onChange={(e) =>
                                            setNewRuleData({ ...newRuleData, description: e.target.value })
                                        }
                                    />
                                </div>
                                {/* SNMP Trap OID */}
                                <div style={{ marginTop: '5px', display: 'flex' }}>
                                    <div style={{ width: '45%', marginRight: '15px' }}>
                                        <span>Warm Up:</span>
                                        <input
                                            type="number"
                                            name="warmup"
                                            value={newRuleData.warmup}
                                            className="inputText"
                                            style={{ width: '243px' }}
                                            onChange={(e) =>
                                                setNewRuleData({ ...newRuleData, warmup: e.target.value })
                                            }
                                        />
                                    </div>
                                    {/* SNMP Trap OID */}
                                    <div style={{ marginLeft: '13px' }}>
                                        <span>Cool Down:</span>
                                        <input
                                            type="number"
                                            name="cooldown"
                                            value={newRuleData.cooldown}
                                            className="inputText"
                                            style={{ width: '243px' }}
                                            onChange={(e) =>
                                                setNewRuleData({ ...newRuleData, cooldown: e.target.value })
                                            }
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

export default StatefulSyslogs;
