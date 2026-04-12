import { useState, useEffect } from 'react';
//import './SignalConfigElement.css';
import Select from 'react-select';
import customStyles from '../../misc/SelectStyles';
import { TailSpin } from 'react-loader-spinner';

import { useTelemetrySignals } from "../../../hooks/useTelemetrySignals";

const TelemetrySignals = ({ keycloak, devices, onReload, snmpTrapOids, tags, showNotification }) => {
    const [snmpTrapRule, setSnmpTrapRule] = useState([]);
    const { rules, ruleDetails, loading: isLoading, error, selectRule, addRule, updateRule, deleteRule } = useTelemetrySignals(keycloak);
    const emptyRule = {
        name: '',
        devices: [],
        highthreshold: '',
        lowthreshold: '',
        openvalue: '',
        closevalue: '', 
        initialseverity: '',
        affectedentity: [],
        description: '',
        warmup: '',
        cooldown: '',
    };
    const [selectedRule, setSelectedRule] = useState(emptyRule);
    const [loadingState, setLoadingState] = useState(null);
    const [isAddingNewRule, setIsAddingNewRule] = useState(true);

    useEffect(() => {
        if (ruleDetails) {
            setSelectedRule(ruleDetails);
        }
        console.log("Rule details updated:", ruleDetails);
    }, [ruleDetails]);

    // SELECT RULE
    const handleSelect = (selectedRule) => {
        setSelectedRule(selectedRule);
        setIsAddingNewRule(false);
        selectRule(selectedRule);
    };

    const getErrorMessage = (err) => {
        if (!err) return "Unknown error";

        if (typeof err === "string") return err;

        if (err.message) {
            try {
                const parsed = JSON.parse(err.message);
                return parsed.detail || err.message;
            } catch {
                return err.message;
            }
        }

        return JSON.stringify(err);
    };

    // ADD
    const handleAdd = async () => {
        setLoadingState('adding');
        try {
            console.log("SENDING FORM:", selectedRule); // 👈 ADD THIS
            await addRule(selectedRule);
            await onReload();
            //await loadList(); // 🔥 refresh list
            showNotification("Rule created successfully", "success");
            setSelectedRule(emptyRule);
        } catch (err) {
            console.error("ADD ERROR:", err); // 👈 ADD THIS
            if (err.detail?.includes("already exists")) {
                showNotification("Name already exists. Choose another.", "error");
            } else {
                showNotification(getErrorMessage(err), "error");
            }
        } finally {
            setLoadingState(null);
        }
    };

    // SAVE
    const handleSave = async () => {
        setLoadingState('saving');
        try {
            console.log("SENDING FORM:", selectedRule); // 👈 ADD THIS
            await updateRule(selectedRule.name, selectedRule);
            await onReload();
            //await loadList(); // 🔥 refresh list
            showNotification("Rule updated successfully", "success");
            setSelectedRule(emptyRule);
        } catch (err) {
            console.error("SAVE ERROR:", err); // 👈 ADD THIS
            showNotification(err.message || String(err), "error");
        } finally {
            setLoadingState(null);
        }
    };

    // DELETE
    const handleDelete = async () => {
        setLoadingState('deleting');
        try {
            await deleteRule(selectedRule.name);
            await onReload();
            //await loadList(); // 🔥 refresh list
            showNotification("Rule deleted successfully", "success");
            setSelectedRule(emptyRule);
        } catch (err) {
            setLoadingState(null);
            console.error("DELETE ERROR:", err); // 👈 ADD THIS
            showNotification(err.message || String(err), "error");
        }
    };


    console.log("Devices:", devices);
    console.log("SNMP Trap OIDs:", snmpTrapOids);
    console.log("Tags:", tags);
    console.log("Selected Rule:", selectedRule);
    console.log("All Rules:", rules);

    return (
        <div className="signalTagContainer">
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
                                        setSelectedRule(emptyRule);
                                    }}>
                                    Add new rule
                                </li>
                                {rules.map((rule) => (
                                    <li
                                        key={rule.id}
                                        className={`signalTagItem ${selectedRule && selectedRule.id === rule.id ? 'selected' : ''}`}
                                        onClick={() => handleSelect(rule)}
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
                                            value={selectedRule.name}
                                            className="inputText"
                                            style={{ width: '500px' }}
                                            onChange={(e) =>
                                                setSelectedRule({ ...selectedRule, name: e.target.value })
                                            }
                                        />
                                    </div>{/*
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Hostname:</span>
                                        <Select
                                            name="hostname"
                                            value={devices.filter(device => selectedRule.devices.includes(device.id)).map(device => ({
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
                                    {selectedRule.devices && selectedRule.devices.length > 0 && (
                                        <div className="tag-detail-row">
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px', paddingLeft: '15px' }}>
                                                    <label style={{ marginRight: '15px' }}>
                                                        <input
                                                            type="radio"
                                                            name="devicesFilter"
                                                            value="include"
                                                            checked={selectedRule.devicesFilter === 'include'}
                                                            onChange={() => setSelectedRule({ ...selectedRule, devicesFilter: 'include' })}
                                                        />
                                                        Include
                                                    </label>
                                                    <label>
                                                        <input
                                                            type="radio"
                                                            name="devicesFilter"
                                                            value="exclude"
                                                            checked={selectedRule.devicesFilter === 'exclude'}
                                                            onChange={() => setSelectedRule({ ...selectedRule, devicesFilter: 'exclude' })}
                                                        />
                                                        Exclude
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    )}*/}
                                    <div>
                                            <span>High Threshold:</span>
                                            <input
                                                type="number"
                                                name="highThreshold"
                                                value={selectedRule.highThreshold}
                                                className="inputText"
                                                style={{ width: '243px' }}
                                                onChange={(e) =>
                                                    setSelectedRule({ ...selectedRule, highThreshold: parseInt(e.target.value, 10) || 0 })
                                                }
                                            />
                                        </div>

                                        <div>
                                            <span>Low Threshold:</span>
                                            <input
                                                type="number"
                                                name="lowThreshold"
                                                value={selectedRule.lowThreshold}
                                                className="inputText"
                                                style={{ width: '243px' }}
                                                onChange={(e) =>
                                                    setSelectedRule({ ...selectedRule, lowThreshold: parseInt(e.target.value, 10) || 0 })
                                                }
                                            />
                                        </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Open Value:</span>
                                            <input
                                                type="text"
                                                name="openvalue"
                                                value={selectedRule.openvalue}
                                                className="inputText"
                                                style={{ width: '243px' }}
                                                onChange={(e) =>
                                                    setSelectedRule({ ...selectedRule, openvalue: e.target.value })
                                                }
                                            />
                                        </div>
                                        <div style={{ marginLeft: '13px' }}>
                                            <span>Close Value:</span>
                                            <input
                                                type="text"
                                                name="closevalue"
                                                value={selectedRule.closevalue}
                                                className="inputText"
                                                style={{ width: '243px' }}
                                                onChange={(e) =>
                                                    setSelectedRule({ ...selectedRule, closevalue: e.target.value })
                                                }
                                            />
                                        </div>
                                    </div> 
                                     
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Affected Entities:</span>
                                        <Select
                                            name="affectedentity"
                                            value={(tags || [])
                                                .filter(tag => (selectedRule.affectedentity || []).includes(tag.name))
                                                .map(tag => ({ value: tag.name, label: tag.name }))
                                            }
                                            options={tags.map(tag => ({
                                                value: tag.name,
                                                label: tag.name,
                                            }))}
                                            onChange={(selectedRules) =>
                                                setSelectedRule({
                                                    ...selectedRule,
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
                                            value={
                                                selectedRule.initialseverity
                                                    ? { value: selectedRule.initialseverity, label: selectedRule.initialseverity }
                                                    : null
                                            }
                                            options={[
                                                { label: "Low", value: "low" },
                                                { label: "Medium", value: "medium" },
                                                { label: "High", value: "high" }
                                            ]}
                                            onChange={(option) =>
                                                setSelectedRule({ ...selectedRule, initialseverity: option?.value || '' })
                                            }
                                            styles={customStyles('505px')}
                                            isMulti={false}
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Description:</span>
                                        <input
                                            type="text"
                                            name="description"
                                            value={selectedRule.description}
                                            className="inputText"
                                            style={{ width: '500px' }}
                                            onChange={(e) =>
                                                setSelectedRule({ ...selectedRule, description: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div style={{ marginTop: '5px', display: 'flex' }}>
                                        <div>
                                            <span>Warm Up:</span>
                                            <input
                                                type="number"
                                                name="warmup"
                                                value={selectedRule.warmup}
                                                className="inputText"
                                                style={{ width: '243px' }}
                                                onChange={(e) =>
                                                    setSelectedRule({ ...selectedRule, warmup: parseInt(e.target.value, 10) || 0 })
                                                }
                                            />
                                        </div>
                                        <div style={{ marginLeft: '10px' }}>
                                            <span>Cool Down:</span>
                                            <input
                                                type="number"
                                                name="cooldown"
                                                value={selectedRule.cooldown}
                                                className="inputText"
                                                style={{ width: '243px' }}
                                                onChange={(e) =>
                                                    setSelectedRule({ ...selectedRule, cooldown: parseInt(e.target.value, 10) || 0 })
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
                            <button
                                onClick={() => setSelectedRule(emptyRule)}
                                className="button cancel-button"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleAdd}
                                disabled={loadingState === 'adding'}
                                className="button add-button"
                            >
                                {loadingState === 'adding' ? (
                                    <TailSpin height={16} width={16} color="#fff" />
                                ) : (
                                    'Add Rule'
                                )}
                            </button>
                        </>
                    ) : (
                        selectedRule && (
                            <>
                                <button
                                    onClick={handleDelete}
                                    disabled={loadingState === 'deleting'}
                                    className="button delete-button"
                                >
                                    {loadingState === 'deleting' ? (
                                        <TailSpin height={16} width={16} color="#fff" />
                                    ) : (
                                        'Delete'
                                    )}
                                </button>

                                <button
                                    onClick={handleSave}
                                    disabled={loadingState === 'saving'}
                                    className="button save-button"
                                >
                                    {loadingState === 'saving' ? (
                                        <TailSpin height={16} width={16} color="#fff" />
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default TelemetrySignals;
