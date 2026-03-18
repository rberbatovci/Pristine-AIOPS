import { useState, useEffect } from 'react';
import './SignalConfigElement.css';
import Select from 'react-select';
import customStyles from '../../misc/SelectStyles';
import { useSnmpTrapRules } from "../../../hooks/useSnmpTrapRules";
import { useSnmpTrapTags } from "../../../hooks/useSnmpTrapTags";
import { useSnmpTrapOids } from "../../../hooks/useSnmpTrapOids";

const StatefulTraps = ({ keycloak }) => {
    const [snmpTrapRule, setSnmpTrapRule] = useState([]);
    const {
        rules,
        selectedRule,
        ruleDetails,
        loading: isLoading,
        error,
        selectRule,
        addRule,
        updateRule,
        deleteRule
    } = useSnmpTrapRules(keycloak);
    const [editedData, setEditedData] = useState({});
    const {
        oids: oidNames = [],
        loading: oidsLoading,
        error: oidsError
    } = useSnmpTrapOids(keycloak);

    const {
        tags: tagNames = [],
        loading: tagsLoading,
        error: tagsError
    } = useSnmpTrapTags(keycloak);
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

    const handleOptionChange = async (rule) => {
        setIsAddingNewRule(false);
        setEditedData(rule);
        await selectRule(rule);
    };

    const handleAddRule = async () => {
        try {
            await addRule(newRule);
            setNewRule({});
            setIsAddingNewRule(false);
        } catch (err) {
            console.error("Error adding rule:", err);
        }
    };

    const handleSave = async () => {
        if (!selectedRule) return;
        try {
            await updateRule(selectedRule.name, editedData);
            setEditedData({});
        } catch (err) {
            console.error("Error updating rule:", err);
        }
    };

    const handleDelete = async () => {
        if (!selectedRule) return;
        try {
            await deleteRule(selectedRule.name);
            setIsAddingNewRule(true);
        } catch (err) {
            console.error("Error deleting rule:", err);
        }
    };

    const handleHostnameChange = (selectedRules) => {
        const selectedIds = selectedRules ? selectedRules.map(option => option.value) : [];
        setNewRule({
            ...newRule,
            devices: selectedIds,
        })
    }

    return (
        <div className="dropdownConfigContainer" style={{ height: '500px' }}>
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading stateful syslog rules. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div style={{ display: 'flex', padding: '10px' }}>
                        <div style={{ width: '270px', padding: '8px', background: 'var(--backgroundColor3)', borderRadius: '8px' }}>
                            <ul>
                                <li
                                    className={`signalTagItem ${isAddingNewRule ? 'selected' : ''}`}
                                    onClick={() => {
                                        setIsAddingNewRule(true);
                                        //setSelectedOption(null);
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
                                        className={`signalTagItem ${selectedRule && selectedRule.id === rule.id ? 'selected' : ''}`}
                                        onClick={() => handleOptionChange(rule)}
                                    >
                                        {rule.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ width: '570px', margin: '5px', background: 'var(--backgroundColor3)', borderRadius: '8px', color: 'var(--textColor)' }}>
                            <div className="tag-details" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                <div style={{ height: '400px', overflowY: 'auto', padding: '8px' }}>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Name:</span>
                                        <input
                                            type="text"
                                            name="name"
                                            value={newRule.name}
                                            className="inputText"
                                            style={{ width: '500px' }}
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
                                            styles={customStyles('505px')}
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
                                            value={
                                                oidNames.length
                                                    ? oidNames.find(option => option.value === newRule.opensignaltrap) ?? null
                                                    : null
                                            }
                                            isMulti={false}
                                            options={oidNames.map(tag => ({
                                                value: tag.value,
                                                label: tag.label,
                                            }))}
                                            onChange={(selectedRule) =>
                                                setNewRule({ ...newRule, opensignaltrap: selectedRule.value })}
                                            styles={customStyles('505px')}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Open Signal Event:</span>
                                            <Select
                                                name="opensignaltag"
                                                value={tagNames.find(option => option.value === newRule.opensignaltag)}
                                                options={tagNames}
                                                onChange={(selectedRule) =>
                                                    setNewRule({ ...newRule, opensignaltag: selectedRule.value })}
                                                styles={customStyles('243px')}
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
                                                style={{ width: '243px' }}
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
                                            value={
                                                oidNames.length
                                                    ? oidNames.find(option => option.value === newRule.closesignaltrap) ?? null
                                                    : null
                                            }
                                            isMulti={false}
                                            options={oidNames.map(tag => ({
                                                value: tag.value,
                                                label: tag.label,
                                            }))}
                                            onChange={(selectedRule) =>
                                                setNewRule({ ...newRule, closesignaltrap: selectedRule.value })}
                                            styles={customStyles('505px')}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Close Signal Event:</span>
                                            <Select
                                                name="closesignaltag"
                                                value={tagNames.find(option => option.value === newRule.closesignaltag)}
                                                options={tagNames}
                                                onChange={(selectedRule) =>
                                                    setNewRule({ ...newRule, closesignaltag: selectedRule.value })}
                                                styles={customStyles('243px')}
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
                                                style={{ width: '243px' }}
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
                                            value={tagNames.filter((tag) => newRule.affectedentity.includes(tag.label))}
                                            options={tagNames}
                                            onChange={(selectedRules) =>
                                                setNewRule({
                                                    ...newRule,
                                                    affectedentity: selectedRules ? selectedRules.map(option => option.label) : []
                                                })
                                            }
                                            styles={customStyles('505px')}
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
                                            onChange={(selectedRule) =>
                                                setNewRule({ ...newRule, initialseverity: selectedRule.value })}
                                            styles={customStyles('505px')}
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
                                            style={{ width: '500px' }}
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
                                                style={{ width: '243px' }}
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
                                                style={{ width: '243px' }}
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
                        selectedRule && (
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
