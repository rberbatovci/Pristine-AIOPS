import React, { useEffect, useState } from 'react';
import apiClient from '../misc/AxiosConfig';

function List({ devices, onDeviceSelect }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    return (
        <div className="device-list">
            <h3>Devices</h3>
            {loading && <p>Loading devices...</p>}
            {error && <p className="error-message">{error}</p>}
            {devices.length === 0 && !loading && !error ? (
                <p>No devices found</p>
            ) : (
                <ul>
                    {devices.map((device) => (
                        <li
                            key={device.id}
                            onClick={() => onDeviceSelect(device)}
                            className="device-list-item"
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
