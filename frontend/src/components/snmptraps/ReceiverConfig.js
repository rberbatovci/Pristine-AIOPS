import React, { useState, useEffect } from 'react';
import '../../css/SyslogTagsList.css';
import apiClient from '../misc/AxiosConfig';

function ReceiverConfig() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [receiverConfig, setReceiverConfig] = useState({
        status: '',
        port: 1161,
        trapOid: '',
        sysUpTime: '',
    });

    // Function to check receiver status
    const checkReceiverStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/snmptraps/receiver/status/');
            setReceiverConfig(prevState => ({
                ...prevState,
                status: response.data.status,
            }));
        } catch (error) {
            setError('Error checking receiver status');
            console.error('Error checking receiver status:', error);
        }
        setIsLoading(false);
    };

    // Function to start the receiver
    const startReceiver = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/snmptraps/receiver/start/');
            setReceiverConfig(prevState => ({
                ...prevState,
                status: response.data.status,
            }));
        } catch (error) {
            setError('Error starting receiver');
            console.error('Error starting receiver:', error);
        }
        setIsLoading(false);
    };

    // Function to stop the receiver
    const stopReceiver = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/snmptraps/receiver/stop/');
            setReceiverConfig(prevState => ({
                ...prevState,
                status: response.data.status,
            }));
        } catch (error) {
            setError('Error stopping receiver');
            console.error('Error stopping receiver:', error);
        }
        setIsLoading(false);
    };

    // Function to check sysUpTime OID
    const checkSysUpTime = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiClient.get('/snmptraps/receiver/sysuptime/');
            setReceiverConfig(prevState => ({
                ...prevState,
                sysUpTime: response.data.sysUpTime,
            }));
        } catch (error) {
            setError('Error checking sysUpTime');
            console.error('Error checking sysUpTime:', error);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        checkReceiverStatus(); // Check status on component mount
    }, []);

    return (
        <div className="signalTagContainer">
            {isLoading ? (
                <div className="signalConfigRuleMessage">
                    Loading SNMP Trap receiver status. Please wait...
                </div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div>
                        <div style={{ marginTop: '2px' }}>SNMP Trap Receiver Configuration:</div>
                        <div className="signalConfigRuleContent" style={{ marginTop: '5px' }}>
                            <div
                                style={{
                                    width: '100%',
                                    margin: '10px',
                                    marginLeft: '0px',
                                    padding: '10px',
                                    height: 'auto',
                                    maxHeight: '100%',
                                    overflowY: 'auto',
                                    borderRadius: '5px',
                                }}
                            >
                                <div style={{ marginBottom: '10px', marginTop: '-5px' }}>
                                    <span>Receiver Status:</span>
                                    <input
                                        type="text"
                                        name="receiverStatus"
                                        className="inputText"
                                        style={{ width: '270px' }}
                                        value={receiverConfig.status || 'Unknown'}
                                        readOnly
                                    />
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <span>Receiver Port:</span>
                                    <input
                                        type="text"
                                        name="receiverPort"
                                        className="inputText"
                                        style={{ width: '270px' }}
                                        value={receiverConfig.port || 'Unknown'}
                                        readOnly
                                    />
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <span>Trap OID:</span>
                                    <input
                                        type="text"
                                        name="trapOid"
                                        className="inputText"
                                        style={{ width: '270px' }}
                                        value={receiverConfig.trapOid || 'Unknown'}
                                        readOnly
                                    />
                                </div>
                                <div>
                                    <span>sysUpTime:</span>
                                    <input
                                        type="text"
                                        name="sysUpTime"
                                        className="inputText"
                                        style={{ width: '270px' }}
                                        value={receiverConfig.sysUpTime || 'Unknown'}
                                        readOnly
                                    />
                                </div>
                            </div>

                        </div>
                        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'center' }}>
                            {receiverConfig.status === 'inactive' ? (
                                <button className="btn btn-success" onClick={startReceiver}>
                                    Start
                                </button>
                            ) : receiverConfig.status === 'active' ? (
                                <button className="btn btn-danger" onClick={stopReceiver}>
                                    Stop
                                </button>
                            ) : null}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default ReceiverConfig;