import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

const IOS_XE_INTERFACES = [
    'GigabitEthernet1', 'GigabitEthernet2', 'Loopback0', 'Loopback1', 'Vlan1'
];

const IOS_XR_INTERFACES = [
    'GigabitEthernet0/0/0/0', 'GigabitEthernet0/0/0/1', 'Loopback0', 'MgmtEth0/RP0/CPU0/0'
];

function NetflowConfig({ selectedDevice, version, onSuccess }) {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [interfaces, setInterfaces] = useState([]);
    const [interfaceOptions, setInterfaceOptions] = useState([]);
    const [showData, setShowData] = useState(false);

    useEffect(() => {
        if (version === 'ios-xe') {
            setInterfaceOptions(IOS_XE_INTERFACES.map((intf) => ({ value: intf, label: intf })));
        } else if (version === 'ios-xr') {
            setInterfaceOptions(IOS_XR_INTERFACES.map((intf) => ({ value: intf, label: intf })));
        } else {
            setInterfaceOptions([]);
        }
    }, [version]);

    const handleChange = (selectedOptions) => {
        setInterfaces(selectedOptions || []);
    };

    const sendConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(`/devices/${selectedDevice.hostname}/netflow-xe-config/`, {
                enabled,
                interfaces: interfaces.map((opt) => opt.value),
            });

            if (onSuccess) onSuccess(response.data);
        } catch (error) {
            console.error('Netflow config failed:', error);
            setError(error.response?.data?.detail || error.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => sendConfig();
    const handleSkip = () => onSuccess?.(null);

    return (
        <div className={`signalRightElementContainer ${showData ? 'netflowConfig' : 'collapsed'}`}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
                    {showData ? '\u25CF' : '\u25CB'} Netflow
                </h2>
                {!selectedDevice?.features?.netflow && (
                                    <div className="zoom-buttons-container">
                                        <div className="headerButtons">
                
                                            {loading ? (
                                                <button disabled={loading} >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <TailSpin
                                                            height="20"
                                                            width="20"
                                                            color="#ffffff"
                                                            ariaLabel="loading"
                                                        />
                                                        <span>Configuring...</span>
                                                    </div>
                                                </button>
                                            ) : (
                                                <button onClick={sendConfig} className="iconButton">
                                                    <IoPushOutline className="defaultIcon" />
                                                    <IoPushSharp className="hoverIcon" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
            </div>
            {showData && (
                <div style={{ padding: '8px', marginLeft: '15px' }}>
                    {/* Status message */}
                    {selectedDevice?.features?.netflow ? (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            Netflow is already configured on this device.
                        </div>
                    ) : (
                        <div style={{ color: 'var(--spanTextColor)' }}>
                            Please configure netflow on the device.
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div style={{ color: 'red', marginTop: '10px' }}>
                            {typeof error === 'string' ? error : JSON.stringify(error)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default NetflowConfig;
