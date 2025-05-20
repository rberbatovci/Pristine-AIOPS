import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '../../css/SyslogTagsList.css';
import customStyles from '../misc/SelectStyles';
import apiClient from '../misc/AxiosConfig';

function UsersConfig({ isLoading, onAdd, onDelete, onEdit }) {
    const [snmpUser, setSnmpUser] = useState({
        username: '',
        engineId: '',
        authPassword: '',
        authProtocol: '',
        privPassword: '',
        privProtocol: '',
        secModel: '', // Initialize secModel
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [alert, setAlert] = useState('');

    const authProtocols = [
        { value: 'md5', label: 'md5' },
        { value: 'sha', label: 'sha' },
    ];

    const securityOptions = [
        { value: 'noAuthNoPriv', label: 'NoAuthNoPriv' },
        { value: 'authNoPriv', label: 'AuthNoPriv' },
        { value: 'authPriv', label: 'AuthPriv' }
    ];

    const privProtocols = [
        { value: '3des', label: '3des' },
        { value: 'aes128', label: 'aes128' },
        { value: 'aes192', label: 'aes192' },
        { value: 'aes256', label: 'aes256C' }, // Corrected value to match backend
        { value: 'des', label: 'des' },
        { value: 'des56', label: 'des56' }
    ];

    const fetchSnmpUsers = () => {
        setLoading(true);
        apiClient
            .get('/traps/receiver/configure/')
            .then((response) => {
                console.log('SNMP User data:', response.data);
                const userData = response.data;
                setSnmpUser({
                    username: userData.username || '',
                    engineId: userData.engineid || '',
                    authPassword: userData.auth_pass || '',
                    authProtocol: userData.auth_proto ? userData.auth_proto.toLowerCase() : '', // Convert to lowercase for matching
                    privPassword: userData.priv_pass || '',
                    privProtocol: userData.priv_proto ? userData.priv_proto.toLowerCase() : '', // Convert to lowercase for matching
                    secModel: userData.msg_flags ? userData.msg_flags.toLowerCase() : '', // Convert to lowercase for matching
                });
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching SNMP User:', error);
                setError('Failed to load SNMP user configuration.');
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchSnmpUsers();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSnmpUser({ ...snmpUser, [name]: value });
    };

    const handleSelectChange = (selectedOption, name) => {
        setSnmpUser({ ...snmpUser, [name]: selectedOption ? selectedOption.value : '' });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                username: snmpUser.username,
                engineid: snmpUser.engineId,
                auth_pass: snmpUser.authPassword,
                auth_proto: snmpUser.authProtocol ? snmpUser.authProtocol.toUpperCase() : '', // Send back in uppercase
                priv_pass: snmpUser.privPassword,
                priv_proto: snmpUser.privProtocol ? snmpUser.privProtocol.toUpperCase() : '', // Send back in uppercase
                msg_flags: snmpUser.secModel ? snmpUser.secModel.charAt(0).toUpperCase() + snmpUser.secModel.slice(1) : '', // Format security model
            };
            const response = await apiClient.put(`/traps/receiver/configure/`, payload);
            console.log('SNMP User updated:', response.data);
            setAlert('SNMP user configuration updated successfully!');
            // Optionally, refetch data or update state based on the response
        } catch (error) {
            console.error('Error updating SNMP user:', error);
            setError('Failed to update SNMP user configuration.');
        } finally {
            setLoading(false);
            setTimeout(() => setAlert(''), 3000); // Clear alert after 3 seconds
        }
    };

    return (
        <div className="signalConfigRuleContainer">
            {loading ? (
                <div className="signalConfigRuleMessage">Loading SNMP user configuration. Please wait...</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    {alert && <div className="alert alert-success">{alert}</div>}
                    <div className="signalConfigRuleContent">
                        <div style={{ width: '350px', margin: '5px', padding: '10px' }}>
                            <div className="tag-details" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                <div style={{ height: 'auto', overflowY: 'auto', padding: '8px' }}>
                                    {/* Username */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Username:</span>
                                        <input
                                            type="text"
                                            name="username"
                                            value={snmpUser.username}
                                            className="inputText"
                                            style={{ width: '315px' }}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    {/* Engine ID */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Engine ID:</span>
                                        <input
                                            type="text"
                                            name="engineId"
                                            value={snmpUser.engineId}
                                            className="inputText"
                                            style={{ width: '315px' }}
                                            onKeyDown={(e) => {
                                                const allowedKeys = [
                                                    'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete',
                                                    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
                                                    'a', 'b', 'c', 'd', 'e', 'f',
                                                    'A', 'B', 'C', 'D', 'E', 'F'
                                                ];
                                                if (
                                                    !allowedKeys.includes(e.key) &&
                                                    !e.ctrlKey && !e.metaKey
                                                ) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onChange={(e) => {
                                                const hexValue = e.target.value.replace(/[^a-fA-F0-9]/g, '');
                                                handleInputChange({ target: { name: 'engineId', value: hexValue } });
                                            }}
                                        />
                                    </div>
                                    {/* Security Model */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Security Model:</span>
                                        <Select
                                            name="secModel"
                                            value={securityOptions.find(option => option.value === snmpUser.secModel)}
                                            options={securityOptions}
                                            onChange={(selectedOption) => handleSelectChange(selectedOption, 'secModel')}
                                            styles={customStyles('320px')}
                                            isMulti={false}
                                        />
                                    </div>
                                    {/* Auth Protocol */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Auth Protocol:</span>
                                        <Select
                                            name="authProtocol"
                                            value={authProtocols.find(protocol => protocol.value === snmpUser.authProtocol)}
                                            options={authProtocols}
                                            onChange={(selectedOption) => handleSelectChange(selectedOption, 'authProtocol')}
                                            styles={customStyles('320px')}
                                            isMulti={false}
                                        />
                                    </div>
                                    {/* Auth Password */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Auth Password:</span>
                                        <input
                                            type="password"
                                            name="authPassword"
                                            value={snmpUser.authPassword}
                                            className="inputText"
                                            style={{ width: '315px' }}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    {/* Priv Protocol */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Priv Protocol:</span>
                                        <Select
                                            name="privProtocol"
                                            value={privProtocols.find(option => option.value === snmpUser.privProtocol)}
                                            options={privProtocols}
                                            onChange={(selectedOption) => handleSelectChange(selectedOption, 'privProtocol')}
                                            styles={customStyles('320px')}
                                            isMulti={false}
                                        />
                                    </div>
                                    {/* Priv Password */}
                                    <div style={{ marginTop: '5px' }}>
                                        <span>Priv Password:</span>
                                        <input
                                            type="password"
                                            name="privPassword"
                                            value={snmpUser.privPassword}
                                            className="inputText"
                                            style={{ width: '315px' }}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {!loading && !error && (
                <div className="signalConfigButtonContainer">
                    <button onClick={handleSave} style={{ marginRight: '10px' }} className="saveRuleButton">
                        Save
                    </button>
                </div>
            )}
        </div>
    );
}

export default UsersConfig;