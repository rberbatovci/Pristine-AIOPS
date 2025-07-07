import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles';

const IOS_XE_INTERFACES = [
    'GigabitEthernet1', 'GigabitEthernet2', 'Loopback0', 'Loopback1', 'Vlan1'
];

const IOS_XR_INTERFACES = [
    'GigabitEthernet0/0/0/0', 'GigabitEthernet0/0/0/1', 'Loopback0', 'MgmtEth0/RP0/CPU0/0'
];

function NetflowConfig({ hostname, version, onSuccess }) {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [interfaces, setInterfaces] = useState([]);
    const [interfaceOptions, setInterfaceOptions] = useState([]);

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
            const response = await apiClient.post(`/devices/${hostname}/netflow-xe-config/`, {
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
        <div className="searchSyslogsContainer">
            <span className="searchSignalFilterText">Configure Netflow</span>
            <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Interfaces:</span>
                    <div style={{ marginTop: '6px' }}>
                        <Select
                            isMulti
                            name="interfaces"
                            value={interfaces}
                            onChange={handleChange}
                            styles={customStyles('300px')}
                            options={interfaceOptions}
                            placeholder="Select interfaces"
                            isSearchable
                            menuPortalTarget={document.body}
                            menuPosition="absolute"
                            menuShouldBlockScroll={true}
                        />
                    </div>
                </div>
            </div>

            {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

            <div style={{ marginTop: '1rem' }}>
                <button onClick={handleSkip} style={{ marginLeft: '1rem' }}>
                    Skip
                </button>
                <button onClick={handleSubmit} disabled={loading}>
                    {loading ? 'Configuring...' : 'Configure Netflow'}
                </button>
            </div>
        </div>
    );
}

export default NetflowConfig;
