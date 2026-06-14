import { useEffect, useState } from "react";
//import "./SignalConfigElement.css";
import Select from "react-select";
import customStyles from "../../misc/SelectStyles";
import { useStatefulSyslogRules } from "../../../hooks/useStatefulSyslogRules"; 
import { useMnemonics } from "../../../hooks/useMnemonics"; 
import { useSyslogTags } from "../../../hooks/useSyslogTags"; 

const StatefulSyslogRules = ({ keycloak, showNotification }) => {
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
    } = useStatefulSyslogRules(keycloak); 
    const { mnemonics, loading: mnemonicsLoading, reload: reloadMnemonics } = useMnemonics(keycloak);
    const { tags: tags, loading: syslogTagsLoading, reload: reloadSyslogTags } = useSyslogTags(keycloak, false);
    const [editedData, setEditedData] = useState({});
    const [isAddingNewRule, setIsAddingNewRule] = useState(true);
    const [newRule, setNewRule] = useState({
        name: "", 
        opensignalmnemonic: "",
        opensignaltag: "",
        opensignalvalue: "",
        closesignalmnemonic: "",
        closesignaltag: "",
        closesignalvalue: "",
        initialseverity: "",
        affectedentity: [],
        description: "",
        warmup: "",
        cooldown: ""
    }); 

      useEffect(() => {
        if (ruleDetails) {
          setNewRule(ruleDetails);
        }
      }, [ruleDetails]);

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
        const selectedIds = selectedRules
            ? selectedRules.map(option => option.value)
            : [];

        setNewRule(prev => ({
            ...prev,
            devices: selectedIds
        }));
    }; 

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
                            <ul style={{ padding: 0, listStyle: 'none' }}>
                                <li
                                    className={`signalTagItem ${isAddingNewRule ? 'selected' : ''}`}
                                    onClick={() => {
                                        setIsAddingNewRule(true);
                                        //setSelectedOption(null);
                                        setNewRule({
                                            name: '', 
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
                                        setEditedData({});
                                    }}>
                                    Add new rule
                                </li>
                                {rules.map((rule) => (
                                    <li
                                        key={rule.id}
                                        className={`signalTagItem ${selectedRule && selectedRule.id === rule.id ? 'selected' : ''
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
                                        value={newRule.name}
                                        className="inputText"
                                        style={{ width: '500px' }}
                                        onChange={(e) =>
                                            setNewRule({ ...newRule, name: e.target.value })
                                        }
                                    />
                                </div>
                                {/* Hostname Field */}
                                {/*
                                <div style={{ marginTop: '5px', marginRight: '15px' }}>
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
                                </div>*/}
                                {/* Hostname Filter */}
                                {/*{newRule.devices && newRule.devices.length > 0 && (
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
                                )}*/}
                                <div style={{ marginTop: '5px', marginRight: '15px' }}>
                                    <span>Open Signal Mnemonic:</span>
                                    <Select
                                        name="opensignalmnemonic "
                                        value={mnemonics.find(option => option.label === newRule.opensignalmnemonic)}
                                        isMulti={false}
                                        options={mnemonics.map(mnemonic => ({
                                            value: mnemonic.value,
                                            label: mnemonic.label,
                                        }))}
                                        onChange={(selectedRule) => {
                                            setNewRule({
                                                ...newRule,
                                                opensignalmnemonic: selectedRule.label
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
                                            value={tags.find(option => option.value === newRule.opensignaltag) || null}
                                            options={tags}
                                            onChange={(selectedRule) =>
                                                setNewRule({ ...newRule, opensignaltag: selectedRule ? selectedRule.value : null })
                                            }
                                            styles={customStyles('243px')}
                                            isMulti={false}
                                        />
                                    </div>
                                    {/* SNMP Trap OID */}
                                    <div style={{ marginLeft: '13px' }}>
                                        <span>Open signal value:</span>
                                        <input
                                            type="text"
                                            name="opensignalvalue"
                                            value={newRule.opensignalvalue}
                                            className="inputText"
                                            onChange={(e) =>
                                                setNewRule({ ...newRule, opensignalvalue: e.target.value })
                                            }
                                            style={{ width: '243px' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ marginTop: '5px' }}>
                                    <span>Close Signal Mnemonic:</span>
                                    <Select
                                        name="closesignalmnemonic"
                                        // Find the mnemonic by its name from newRule and set the default value
                                        value={mnemonics.find(option => option.label === newRule.closesignalmnemonic)}
                                        isMulti={false}
                                        options={mnemonics.map(mnemonic => ({
                                            value: mnemonic.value,
                                            label: mnemonic.label,
                                        }))}

                                        onChange={(selectedRule) =>
                                            setNewRule({ ...newRule, closesignalmnemonic: selectedRule.label })}
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
                                            value={tags.find(option => option.value === newRule.closesignaltag) || null}
                                            options={tags}
                                            onChange={(selectedRule) =>
                                                setNewRule({ ...newRule, closesignaltag: selectedRule ? selectedRule.value : null })
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
                                            value={newRule.closesignalvalue}
                                            className="inputText"
                                            onChange={(e) =>
                                                setNewRule({ ...newRule, closesignalvalue: e.target.value })
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
                                        value={tags.filter((tag) => newRule.affectedentity.includes(tag.value))}
                                        options={tags}
                                        onChange={(selectedRules) =>
                                            setNewRule({
                                                ...newRule,
                                                affectedentity: selectedRules ? selectedRules.map(option => option.value) : []
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
                                        value={{ label: newRule.initialseverity, value: newRule.initialseverity }}
                                        options={[
                                            { label: "Low", value: "low" },
                                            { label: "Medium", value: "medium" },
                                            { label: "High", value: "high" }
                                        ]}
                                        onChange={(selectedRule) =>
                                            setNewRule({ ...newRule, initialseverity: selectedRule.value })}
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
                                        value={newRule.description}
                                        className="inputText"
                                        style={{ width: '500px' }}
                                        onChange={(e) =>
                                            setNewRule({ ...newRule, description: e.target.value })
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
                                            value={newRule.warmup}
                                            className="inputText"
                                            style={{ width: '243px' }}
                                            onChange={(e) =>
                                                setNewRule({ ...newRule, warmup: e.target.value })
                                            }
                                        />
                                    </div>
                                    {/* SNMP Trap OID */}
                                    <div style={{ marginLeft: '13px' }}>
                                        <span>Cool Down:</span>
                                        <input
                                            type="number"
                                            name="cooldown"
                                            value={newRule.cooldown}
                                            className="inputText"
                                            style={{ width: '243px' }}
                                            onChange={(e) =>
                                                setNewRule({ ...newRule, cooldown: e.target.value })
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
                        selectedRule && (
                            <>
                                <button
                                    onClick={handleDelete}
                                    className="buttonStyles deleteRuleButton"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="buttonStyles deleteRuleButton"
                                >
                                    Save
                                </button>
                            </>
                        )
                    )}
                </div>
            )}
        </div >
    );
};

export default StatefulSyslogRules;
