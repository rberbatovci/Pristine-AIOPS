import React, { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import apiClient from '../misc/AxiosConfig';
import customStyles from '../misc/SelectStyles';

function NetflowConfig({ hostname, onSuccess }) {
    const [enabled, setEnabled] = useState(false); // if you want to allow enabling/disabling Netflow
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [interfaces, setInterfaces] = useState([]); // stores interface entries

    const handleCreateOption = (inputValue) => {
        const newOption = { value: inputValue, label: inputValue };
        setInterfaces((prev) => [...prev, newOption]);
    };

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
            if (error.response?.data?.detail) {
                setError(error.response.data.detail);
            } else {
                setError(error.message || 'Unknown error');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        sendConfig();
    };

    const handleSkip = () => {
        if (onSuccess) onSuccess(null); // or however you want to handle skip
    };

    return (
        <div className="searchSyslogsContainer">
            <span className="searchSignalFilterText">Configure Netflow</span>
            <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Interfaces:</span>
                    <div style={{ marginTop: '6px' }}>
                        <CreatableSelect
                            isMulti
                            name="interfaces"
                            value={interfaces}
                            onChange={handleChange}
                            onCreateOption={handleCreateOption}
                            styles={customStyles}
                            placeholder="Enter interfaces"
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
