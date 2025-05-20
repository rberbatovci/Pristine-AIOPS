import React, { useState, useEffect } from 'react';
import './SignalConfigElement.css';
import Select from 'react-select';
import customStyles from '../../misc/SelectStyles';
import apiClient from '../../misc/AxiosConfig';

const StatefulTraps = () => {
    const [selectedOption, setSelectedOption] = useState(null);
    const [snmpTrapRule, setSnmpTrapRule] = useState([]);
    const [editedData, setEditedData] = useState({});
    const [snmpTrapOids, setSnmpTrapOids] = useState([]);
    const [oidNames, setOidNames] = useState([]);
    const [trapTags, setTrapTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [devices, setDevices] = useState([]);
    const [newRule, setNewRule] = useState({
        name: '',
        devices: [],
        opensignaltrap: '',
        opensignaltag: '',
        opensignalvalue: '',
        closesignaltrap: '',
        closesignaltag: '',
        closesignalvalue: '',
        initialseverity: '',
        affectedentity: [],
        description: '',
        warmup: '',
        cooldown: '',
    });
    const [isAddingNewRule, setIsAddingNewRule] = useState(true);

    const fetchTrapTags = () => {
        apiClient
            .get('/traps/tags/')
            .then((response) => {
                console.log('SNMP Trap Tags list2:', response.data);
                const trapTags = response.data.map((Oid) => ({
                    value: Oid.name,
                    label: Oid.name,
                }));
                setTrapTags(trapTags);
            })
            .catch((error) => {
                console.error('Error fetching SNMP Trap Tags:', error);
                setError('Error fetching SNMP Trap Tags. Please try again.');
            });
    };

    const fetchStatefulTrapRules = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/traps/statefulrules/');
            setSnmpTrapRule(response.data);
        } catch (error) {
            console.error('Error fetching syslog rules:', error);
            setError('Error fetching stateful syslog rules:')
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSnmpTrapOids = async () => {
        try {
            const response = await apiClient.get('/traps/trapOids/');
            const oids = response.data.map((oid) => ({
                value: oid.name,
                label: oid.name,
            }));
            setSnmpTrapOids(oids);
        } catch (error) {
            console.error('Error fetching SNMP Trap OID data:', error);
        }
    };

    useEffect(() => {
        fetchStatefulTrapRules();
        fetchSnmpTrapOids();
        fetchTrapTags();
    }, []);

    const handleOptionChange = (rule) => {
        setSelectedOption(rule);
        setIsAddingNewRule(false);
        setEditedData(rule);

        apiClient.get(`/traps/statefulrules/${rule.name}/`)
            .then((response) => {
                setNewRule(response.data);
                console.log('Fetched Syslog Tag Details:', response.data);
            })
            .catch((error) => {
                console.error('Error fetching syslog tag details:', error);
            });
    };

    const handleAddRule = async () => {
        const payload = {
            name: newRule.name,
            devices: newRule.devices,
            opensignaltrap: newRule.opensignaltrap,
            opensignaltag: newRule.opensignaltag,
            opensignalvalue: newRule.opensignalvalue,
            closesignaltrap: newRule.closesignaltrap,
            closesignaltag: newRule.closesignaltag,
            closesignalvalue: newRule.closesignalvalue,
            initialseverity: newRule.initialseverity,
            affectedentity: newRule.affectedentity,
            description: newRule.description,
            warmup: newRule.warmup,
            cooldown: newRule.cooldown
        };
        try {
            console.log("Payload:", payload);
            const response = await apiClient.post('/traps/statefulrules/', payload);
            setNewRule({});
            fetchStatefulTrapRules();
        } catch (error) {
            console.error("Error adding rule:", error);
            setError("Failed to add rule. Please try again.");
        }
    };

    const handleSave = async () => {
        try {
            const { id } = newRule;
            const response = await apiClient.put(`/snmptraps/statefultraprules/${id}/`, newRule);
            setNewRule(snmpTrapRule.map(rule => (rule.id === id ? response.data : rule)));
            setSelectedOption(response.data);
            setNewRule({
                name: '',
                devices: [],
                opensignaltrap: '',
                opensignaltag: '',
                opensignalvalue: '',
                closesignaltrap: '',
                closesignaltag: '',
                closesignalvalue: '',
                initialseverity: '',
                affectedentity: [],
                description: '',
                warmup: '',
                cooldown: '',
            });
            setIsAddingNewRule(true);
        } catch (error) {
            console.error('Error updating tag:', error);
        }
    };

    const handleDelete = async () => {
        try {
            await apiClient.delete(`/traps/statefulrules/${editedData.name}/`);
            setSnmpTrapRule(snmpTrapRule.filter(rule => rule.id !== editedData.id));
            setSelectedOption(null);
        } catch (error) {
            console.error('Error deleting rule:', error);
        }
    };

    const handleHostnameChange = (selectedOptions) => {
        const selectedIds = selectedOptions ? selectedOptions.map(option => option.value) : [];
        setNewRule({
            ...newRule,
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
                                        setNewRule({
                                            name: '',
                                            devices: [],
                                            opensignaltrap: '',
                                            opensignaltag: '',
                                            opensignalvalue: '',
                                            closesignaltrap: '',
                                            closesignaltag: '',
                                            closesignalvalue: '',
                                            initialseverity: '',
                                            affectedentity: [],
                                            description: '',
                                            warmup: '',
                                            cooldown: '',
                                        });
                                        setEditedData({});
                                    }}>
                                    Add new rule
                                </li>
                                {snmpTrapRule.map((rule) => (
                                    <li
                                        key={rule.id}
                                        className={`button ${selectedOption && selectedOption.id === rule.id ? 'button-active' : ''}`}
                                        onClick={() => handleOptionChange(rule)}
                                    >
                                        {rule.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ width: '570px', margin: '5px' }}>
                            <div className="tag-details" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                <div style={{ height: '400px', overflowY: 'auto', padding: '8px' }}>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Name:</span>
                                        <input
                                            type="text"
                                            name="name"
                                            value={newRule.name}
                                            className="inputText"
                                            style={{ width: '535px' }}
                                            onChange={(e) =>
                                                setNewRule({ ...newRule, name: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Hostname:</span>
                                        <Select
                                            name="hostname"
                                            value={devices.filter(device => newRule.devices.includes(device.id)).map(device => ({
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
                                    {newRule.devices && newRule.devices.length > 0 && (
                                        <div className="tag-detail-row">
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', paddingLeft: '15px' }}>
                                                    <label style={{ marginRight: '15px' }}>
                                                        <input
                                                            type="radio"
                                                            name="devicesFilter"
                                                            value="include"
                                                            checked={newRule.devicesFilter === 'include'}
                                                            onChange={() => setNewRule({ ...newRule, devicesFilter: 'include' })}
                                                        />
                                                        Include
                                                    </label>
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name="devicesFilter"
                                                            value="exclude"
                                                            checked={newRule.newRule === 'exclude'}
                                                            onChange={() => setNewRule({ ...newRule, devicesFilter: 'exclude' })}
                                                        />
                                                        Exclude
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Open Signal OID:</span>
                                        <Select
                                            name="opensignaltrap"
                                            value={snmpTrapOids.find(option => option.label === newRule.opensignaltrap) || null}
                                            isMulti={false}
                                            options={snmpTrapOids.map(tag => ({
                                                value: tag.value,
                                                label: tag.label,
                                            }))}
                                            onChange={(selectedOption) =>
                                                setNewRule({ ...newRule, opensignaltrap: selectedOption.value })}
                                            styles={customStyles('540px')}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Open Signal Event:</span>
                                            <Select
                                                name="opensignaltag"
                                                value={trapTags.find(option => option.value === newRule.opensignaltag)}
                                                options={trapTags}
                                                onChange={(selectedOption) =>
                                                    setNewRule({ ...newRule, opensignaltag: selectedOption.value })}
                                                styles={customStyles('260px')}
                                                isMulti={false}
                                            />
                                        </div>
                                        <div style={{ marginLeft: '13px' }}>
                                            <span>Open signal value:</span>
                                            <input
                                                type="text"
                                                name="opensignalvalue"
                                                value={newRule.opensignalvalue}
                                                className="inputText"
                                                style={{ width: '260px' }}
                                                onChange={(e) =>
                                                    setNewRule({ ...newRule, opensignalvalue: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Close Signal OID:</span>
                                        <Select
                                            name="closesignaltrap"
                                            value={snmpTrapOids.find(option => option.label === newRule.closesignaltrap) || null}
                                            isMulti={false}
                                            options={snmpTrapOids.map(tag => ({
                                                value: tag.value,
                                                label: tag.label,
                                            }))}
                                            onChange={(selectedOption) =>
                                                setNewRule({ ...newRule, closesignaltrap: selectedOption.value })}
                                            styles={customStyles('540px')}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Close Signal Event:</span>
                                            <Select
                                                name="closesignaltag"
                                                value={trapTags.find(option => option.value === newRule.closesignaltag)}
                                                options={trapTags}
                                                onChange={(selectedOption) =>
                                                    setNewRule({ ...newRule, closesignaltag: selectedOption.value })}
                                                styles={customStyles('260px')}
                                                isMulti={false}
                                            />
                                        </div>
                                        <div style={{ marginLeft: '13px' }}>
                                            <span>Close signal value:</span>
                                            <input
                                                type="text"
                                                name="closesignalvalue"
                                                value={newRule.closesignalvalue}
                                                className="inputText"
                                                style={{ width: '260px' }}
                                                onChange={(e) =>
                                                    setNewRule({ ...newRule, closesignalvalue: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Affected Entities:</span>
                                        <Select
                                            name="affectedentity"
                                            value={trapTags.filter((tag) => newRule.affectedentity.includes(tag.label))}
                                            options={trapTags}
                                            onChange={(selectedOptions) =>
                                                setNewRule({
                                                    ...newRule,
                                                    affectedentity: selectedOptions ? selectedOptions.map(option => option.label) : []
                                                })
                                            }
                                            styles={customStyles('540px')}
                                            isMulti
                                        />
                                    </div>

                                    <div style={{ marginTop: '5px' }}>
                                        <span>Initial Severity:</span>
                                        <Select
                                            name="initialseverity"
                                            value={{ label: newRule.initialseverity, value: newRule.initialseverity }}
                                            options={[
                                                { label: "Low", value: "low" },
                                                { label: "Medium", value: "medium" },
                                                { label: "High", value: "high" }
                                            ]}
                                            onChange={(selectedOption) =>
                                                setNewRule({ ...newRule, initialseverity: selectedOption.value })}
                                            styles={customStyles('540px')}
                                            isMulti={false}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Description:</span>
                                        <input
                                            type="text"
                                            name="description"
                                            value={newRule.description}
                                            className="inputText"
                                            style={{ width: '535px' }}
                                            onChange={(e) =>
                                                setNewRule({ ...newRule, description: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Warm Up:</span>
                                            <input
                                                type="number"
                                                name="warmup"
                                                value={newRule.warmup}
                                                className="inputText"
                                                style={{ width: '260px' }}
                                                onChange={(e) =>
                                                    setNewRule({ ...newRule, warmup: parseInt(e.target.value, 10) || 0 })
                                                }
                                            />
                                        </div>
                                        <div style={{ marginLeft: '10px' }}>
                                            <span>Cool Down:</span>
                                            <input
                                                type="number"
                                                name="cooldown"
                                                value={newRule.cooldown}
                                                className="inputText"
                                                style={{ width: '260px' }}
                                                onChange={(e) =>
                                                    setNewRule({ ...newRule, cooldown: parseInt(e.target.value, 10) || 0 })
                                                }
                                            />
                                        </div>
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
                            <button onClick={handleAddRule} className="buttonStyles newRuleButton">
                                Add Rule
                            </button>
                            <button onClick={() => isAddingNewRule(false)} className="buttonStyles cancelButton">
                                Cancel
                            </button>
                        </>
                    ) : (
                        selectedOption && (
                            <>
                                <button onClick={handleSave} className="buttonStyles saveRuleButton">
                                    Save
                                </button>
                                <button onClick={handleDelete} className="buttonStyles deleteRuleButton">
                                    Delete
                                </button>
                            </>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default StatefulTraps;
