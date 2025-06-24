import React, { useEffect, useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import '../../css/SignalsList.css';

function List({ devices, onDeviceSelect }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedDevice, setSelectedDevice] = useState(null);

    const handleDeviceClick = (device) => {
        setSelectedDevice(device);
        onDeviceSelect(device); 
    };

    return (
        <div className="signals-list-container">
            {loading && <p>Loading devices...</p>}
            {error && <p className="error-message">{error}</p>}
            {devices.length === 0 && !loading && !error ? (
                <p>No devices found</p>
            ) : (
                <ul className="signals-list" style={{ paddingLeft: '0', listStyle: 'none' }}>
                    {devices.map((device) => (
                        <li
                            key={device.id}
                            onClick={() => handleDeviceClick(device)}
                            className={`listElement ${selectedDevice?.id === device.id ? 'listElementActive' : ''}`}
                            style={{ height: '40px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        >
                            {device.hostname} ({device.ip_address})
                        </li>
                    ))}
                </ul>
            )}
        </div>

    );
}

export default List;
