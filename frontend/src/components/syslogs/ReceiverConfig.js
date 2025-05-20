import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import Select from 'react-select';
import customStyles from '../../components/misc/SelectStyles';
import apiClient from '../misc/AxiosConfig';

function SyslogReceiverConfig() {
    const baseUrl = `http://${process.env.REACT_APP_SERVER_IP}:${process.env.REACT_APP_SERVER_PORT}`;

    // Updated receiveStatus logic
    const receiveStatus = {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        INACTIVE_NEVER_ACTIVE: 'inactive_never_active',
    };

    const [receiverStatus, setReceiverStatus] = useState(receiveStatus.INACTIVE_NEVER_ACTIVE);
    const [selectedItem, setSelectedItem] = useState('Receiver Status');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [configData, setConfigData] = useState({
        status: '',
        port: 1160,
    })

    const [advConfigData, setAdvConfigData] = useState({
        agent: '',
        agentPattern: '',
        agentFunction: '',
        agentGroupNr: '',
        mnemonicPattern: '',
        mnemonicFunction: '',
        mnemonicGroupNr: '',
        timestamp: '',
        timestampPattern: '',
        timestampFunction: '',
        timestampGroupNr: '',
    });

    const [agentConfigData, setAgentConfigData] = useState({
        device: '',
        regExPattern: '',
        regExFunciton: '',
        regExGrNr: ''
    })

    const [mnemonicConfigData, setMnemonicConfigData] = useState({
        regExPattern: '',
        regExFunction: '',
        regExGrNr: ''  
    })

    const [timestampConfigData, setTimestampConfigData] = useState({
        timestamp: '',
        regExPattern: '',
        regExFunction: '',
        regExGrNr: ''
    })

    const agentOptions = [
        { value: 'ip_address', label: 'IP Address' },
        { value: 'Hostname', label: 'Hostname' }
    ];

    const functionOptions = [
        { value: 'search', label: 'Search' },
        { value: 'findall', label: 'Findall' },
        { value: 'finditer', label: 'Finditer' }
    ];

    const timestampOptions = [
        { value: 'autoNow', label: 'Auto Now' },
        { value: 'inSyslog', label: 'In Syslog' }
    ];

    const handleAgentChange = (selectedOption) => {
        setAdvConfigData({ ...advConfigData, agent: selectedOption.value });
    };

    const handleTimestampChange = (selectedOption) => {
        setAdvConfigData({ ...advConfigData, timestamp: selectedOption.value });
    };

    const checkAgentConfiguration = async () => {
        if (agentConfigData && Object.values(agentConfigData).some(val => val)) {
            console.log('Agent config already fetched:', agentConfigData);
            return;
        }
        try {
            const response = await apiClient.get('/syslogs/receiver/config/agent/');
            const agentConfig = response.data;
            setAgentConfigData(agentConfig);
            console.log('Fetched Agent Configuration:', agentConfig);
        } catch (error) {
            setReceiverStatus(receiveStatus.INACTIVE_NEVER_ACTIVE);
            console.error('Error fetching agent config:', error);
        }
    };
    
    const checkTimestampConfiguration = async () => {
        if (timestampConfigData && Object.values(timestampConfigData).some(val => val)) {
            console.log('Timestamp config already fetched:', timestampConfigData);
            return;
        }
        try {
            const response = await apiClient.get('/syslogs/receiver/config/timestamp/');
            const timestampConfig = response.data;
            setTimestampConfigData(timestampConfig);
            console.log('Fetched Timestamp Configuration:', timestampConfig);
        } catch (error) {
            console.error('Error fetching timestamp config:', error);
        }
    };
    
    const checkMnemonicConfiguration = async () => {
        if (mnemonicConfigData && Object.values(mnemonicConfigData).some(val => val)) {
            console.log('Mnemonic config already fetched:', mnemonicConfigData);
            return;
        }
        try {
            const response = await apiClient.get('/syslogs/receiver/config/mnemonic/');
            const mnemonicConfig = response.data;
            setMnemonicConfigData(mnemonicConfig);
            console.log('Fetched Mnemonic Configuration:', mnemonicConfig);
        } catch (error) {
            console.error('Error fetching mnemonic config:', error);
        }
    };

    const handleItemClick = (item) => {
        if (item == 'Configure Agent') {
            checkAgentConfiguration();
        } else if (item == 'Configure Timestamp') {
            checkTimestampConfiguration();
        } else if (item == 'Configure Mnemonic') {
            checkMnemonicConfiguration();
        }
        setSelectedItem(item);
    };

    const handleStop = async () => {
        try {
            // Send a request to stop the syslog receiver
            const response = await apiClient.post('/syslogs/receiver/stop/');

            if (response.status === 200) {
                // Update the status on success, maybe to INACTIVE?
                setReceiverStatus(receiveStatus.INACTIVE);
                alert('Syslog receiver stopped successfully');
            }
        } catch (error) {
            console.error('Error stopping syslog receiver:', error);
            alert('Failed to stop syslog receiver');
        }
    };

    const handleConfiguration = () => {
        // Validation checks for required fields
        if (!advConfigData.agent) {
            alert("Agent is a required field.");
            return;
        }
        if (!advConfigData.mnemonicPattern || !advConfigData.mnemonicFunction || !advConfigData.mnemonicGroupNr) {
            alert("Please fill all Mnemonic Pattern, Function, and Group Number fields.");
            return;
        }
        if (!advConfigData.timestamp) {
            alert("Timestamp is a required field.");
            return;
        }

        // Additional validation when agent is 'Hostname'
        if (advConfigData.agent === 'Hostname') {
            if (!advConfigData.agentPattern || !advConfigData.agentFunction || !advConfigData.agentGroupNr) {
                alert("Please fill all Agent Pattern, Function, and Group Number fields.");
                return;
            }
        }

        // Additional validation when timestamp is 'inSyslog'
        if (advConfigData.timestamp === 'inSyslog') {
            if (!advConfigData.timestampPattern || !advConfigData.timestampFunction || !advConfigData.timestampGroupNr) {
                alert("Please fill all Timestamp Pattern, Function, and Group Number fields.");
                return;
            }
        }

        if (configData.status === 'active') {
            alert("Configuration cannot be applied while the status is 'active'.");
            return;
        }

        const payload = {
            receiverAgent: advConfigData.agent,
            receiverAgentPattern: advConfigData.agentPattern,
            receiverAgentFunction: advConfigData.agentFunction,
            receiverAgentGroupNr: advConfigData.agentGroupNr,
            receiverMnemonicPattern: advConfigData.mnemonicPattern,
            receiverMnemonicFunction: advConfigData.mnemonicFunction,
            receiverMnemonicGroupNr: advConfigData.mnemonicGroupNr,
            receiverTimestamp: advConfigData.timestamp,
            receiverTimestampPattern: advConfigData.timestampPattern,
            receiverTimestampFunction: advConfigData.timestampFunction,
            receiverTimestampGroupNr: advConfigData.timestampGroupNr,
        };

        // Send POST request
        apiClient.post('/syslogs/receiver/configure/', payload)
            .then(response => {
                // Handle successful response
                console.log("Configuration applied successfully", response.data);
            })
            .catch(error => {
                // Handle error
                console.error("There was an error with the configuration request", error);
            });
    };

    const handlePortChange = (event) => {
        // Update the configData with the new port value
        const newPort = event.target.value; // Get the new port value
        setConfigData((prevConfigData) => ({
            ...prevConfigData,
            port: newPort, // Update the port in configData
        }));
    };

    const renderContent = () => {
        switch (selectedItem) {
            case 'Receiver Status':
                return (
                    <div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>Status:</span>
                            <input type="text" name="status" className="inputText" style={{ width: '240px' }} value={configData.status || ""} readOnly />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>Port:</span>
                            <input type="number" name="port" className="inputText" style={{ width: '240px' }} value={configData.port || ""} onChange={handlePortChange} />
                        </div>
                        <div className="tag-detail-row">
                            <button onClick={handleStart}>Start</button>
                            <button onClick={handleStop}>Stop</button>
                            <button onClick={handleReset}>Reset</button>
                            <button onClick={handleConfiguration}>Configure</button>
                        </div>
                    </div>
                );
            case 'Configure Agent':
                return (
                    <div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>Agent:</span>
                            <Select
                                name="agent"
                                options={agentOptions}
                                styles={customStyles}
                                isMulti={false}
                                value={agentOptions.find(option => option.value === agentConfigData.device) || null}
                                onChange={(selectedOption) =>
                                    setAdvConfigData({ ...agentConfigData, device: selectedOption.value })}
                            />
                        </div>

                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Pattern:</span>
                            <input
                                type="text"
                                name="agentPattern"
                                className="inputText"
                                style={{ width: '240px' }}
                                value={agentConfigData.regExPattern || null}
                                onChange={(e) =>
                                    setAdvConfigData({ ...agentConfigData, regExPattern: e.target.value })
                                }
                            />
                        </div>
                        <div style={{display: 'flex'}}>
                        <div style={{ marginBottom: '10px', width: '250px' }}>
                            <span>RegEx Function:</span>
                            <Select
                                name="regExFunction"
                                options={functionOptions}
                                styles={customStyles}
                                isMulti={false}
                                value={functionOptions.find(option => option.value === agentConfigData.regExFunction) || null}
                                onChange={(selectedOption) =>
                                    setAdvConfigData({ ...agentConfigData, regExFunction: selectedOption.value })}
                                disabled={agentConfigData.device !== 'Hostname'}
                            />
                        </div>
                        <div style={{ marginBottom: '10px', marginLeft: '20px' }}>
                            <span>RegEx Group Number:</span>
                            <input
                                type="number"
                                name="regExGrNr"
                                className="inputText"
                                style={{width: '180px'}}
                                value={agentConfigData.regExGrNr}
                                onChange={(e) =>
                                    setAdvConfigData({ ...agentConfigData, regExGrNr: e.target.value })
                                }
                                disabled={agentConfigData.agent !== 'Hostname'} />
                        </div>
                        </div>
                    </div>
                );
            case 'Configure Mnemonic':
                return (
                    <div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Pattern:</span>
                                <input
                                    type="text"
                                    name="regExPattern"
                                    className="inputText"
                                    value={mnemonicConfigData.regExPattern || ""}
                                    onChange={(e) =>
                                        setMnemonicConfigData({ ...mnemonicConfigData, regExPattern: e.target.value })
                                    } />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Function:</span>
                                <Select
                                    name="regExFunction"
                                    options={functionOptions}
                                    styles={customStyles}
                                    isMulti={false}
                                    value={functionOptions.find(option => option.value === mnemonicConfigData.regExFunction) || null}
                                    onChange={(selectedOption) =>
                                        setMnemonicConfigData({ ...mnemonicConfigData, regExFunction: selectedOption.value })}
                                />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Group Number:</span>
                                <input
                                    type="number"
                                    name="regExGrNr"
                                    className="inputText"
                                    value={mnemonicConfigData.regExGrNr || ""}
                                    onChange={(e) =>
                                        setMnemonicConfigData({ ...mnemonicConfigData, regExGrNr: e.target.value })
                                    } />
                        </div>
                    </div>
                );
            case 'Configure Timestamp':
                return (
                    <div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>Timestamp:</span>
                                <Select
                                    name="timestamp"
                                    options={timestampOptions}
                                    styles={customStyles}
                                    isMulti={false}
                                    value={timestampOptions.find(option => option.value === timestampConfigData.timestamp) || null}
                                    onChange={(selectedOption) =>
                                        setTimestampConfigData({ ...timestampConfigData, timestamp: selectedOption.value })}
                                />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Pattern:</span>
                                <input
                                    type="text"
                                    name="regExPattern"
                                    className="inputText"
                                    style={{ width: '340px' }}
                                    value={timestampConfigData.regExPattern || ""}
                                    onChange={(e) => setTimestampConfigData({ ...timestampConfigData, regExPattern: e.target.value })}
                                    disabled={timestampConfigData.timestamp !== 'inSyslog'}
                                />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Function:</span>
                                <Select
                                    name="regExFunction"
                                    options={functionOptions}
                                    styles={customStyles}
                                    isMulti={false}
                                    value={functionOptions.find(option => option.value === timestampConfigData.regExFunction) || null}
                                    onChange={(selectedOption) => setTimestampConfigData({ ...timestampConfigData, regExFunction: selectedOption.value })}
                                    isDisabled={timestampConfigData.timestamp !== 'inSyslog'}
                                />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <span>RegEx Group Number:</span>
                                <input
                                    type="number"
                                    name="regExGrNr"
                                    className="inputText"
                                    value={timestampConfigData.regExGrNr || ""}
                                    onChange={(e) => setTimestampConfigData({ ...timestampConfigData, regExGrNr: e.target.value })}
                                    disabled={timestampConfigData.timestamp !== 'inSyslog'}
                                />
                        </div>
                    </div>
                );
            default:
                return <p>Please select an option from the list.</p>;
        }
    };

    const handleStart = async () => {
        try {
            const response = await apiClient.post(
                `/syslogs/receiver/start/?port=${configData.port}`
            );
    
            if (response.status === 200) {
                alert('Syslog receiver started successfully');
            }
        } catch (error) {
            console.error('Error starting syslog receiver:', error);
            alert('Failed to start syslog receiver');
        }
    };

    const handleReset = async () => {
        try {
            const response = await apiClient.post('/syslogs/receiver/reset/');

            if (response.status === 200) {
                setConfigData({});
                setAdvConfigData({});
                alert('Syslog receiver configuration reset successfully');
            }
        } catch (error) {
            console.error('Error resetting syslog receiver configuration:', error);
            alert('Failed to reset syslog receiver configuration');
        }
    };


    useEffect(() => {
        const checkSyslogReceiverStatus = async () => {
            try {
                const response = await apiClient.get('/syslogs/receiver/status/');
                const lastConfig = response.data;

                if (lastConfig) {
                    setConfigData((prevData) => ({
                        ...prevData,
                        status: lastConfig.status,
                        ...(lastConfig.status === 'active' && { port: lastConfig.port }),
                    }));
                }

                console.log('Syslog Receiver Configuration:', configData);
            } catch (error) {
                setReceiverStatus('INACTIVE_NEVER_ACTIVE');
                console.error('Error checking syslog receiver status:', error);
            }
        };

        const checkSyslogReceiverConfiguration = async () => {
            try {
                const response = await apiClient.get('/syslogs/receiver/configure/');
                const config = response.data;

                if (config) {
                    setAdvConfigData({
                        agent: config.receiverAgent || '',
                        agentPattern: config.receiverAgentPattern || '',
                        agentFunction: config.receiverAgentFunction || '',
                        agentGroupNr: config.receiverAgentGroupNr || '',
                        mnemonicPattern: config.receiverMnemonicPattern || '',
                        mnemonicFunction: config.receiverMnemonicFunction || '',
                        mnemonicGroupNr: config.receiverMnemonicGroupNr || '',
                        timestamp: config.receiverTimestamp || '',
                        timestampPattern: config.receiverTimestampPattern || '',
                        timestampFunction: config.receiverTimestampFunction || '',
                        timestampGroupNr: config.receiverTimestampGroupNr || '',
                    });
                }
            } catch (error) {
                console.error('Error fetching Syslog Receiver Configuration', error);
            }
        };

        checkSyslogReceiverStatus();
        checkSyslogReceiverConfiguration();
    }, []);

    return (
        <div className="signalTagContainer">
            {isLoading ? (
                <div className="signalConfigRuleMessage">
                    Loading stateful syslog rules. Please wait...
                </div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div>
                    <div style={{marginTop: '2px'}}>Syslog Receiver Configuration:</div>
                    <div className="signalConfigRuleContent" style={{ marginTop: '5px' }}>
                        <div className="signalConfigRulesList" style={{width: '40%'}}>
                            <ul>
                                <li className={`listElement button ${selectedItem === 'Receiver Status' ? 'button-active' : ''}`}
                                    onClick={() => handleItemClick('Receiver Status')}
                                >
                                    Receiver Status
                                </li>
                                <li
                                    className={`listElement button ${selectedItem === 'Configure Agent' ? 'button-active' : ''}`}
                                    onClick={() => handleItemClick('Configure Agent')}
                                >
                                    Configure Agent
                                </li>
                                <li
                                    className={`listElement button ${selectedItem === 'Configure Mnemonic' ? 'button-active' : ''}`}
                                    onClick={() => handleItemClick('Configure Mnemonic')}
                                >
                                    Configure Mnemonic
                                </li>
                                <li
                                    className={`listElement button ${selectedItem === 'Configure Timestamp' ? 'button-active' : ''}`}
                                    onClick={() => handleItemClick('Configure Timestamp')}
                                >
                                    Configure Timestamp
                                </li>
                            </ul>
                        </div>
                        <div style={{ width: '60%', margin: '10px' }}>
                            {renderContent()}
                        </div>
                    </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default SyslogReceiverConfig;