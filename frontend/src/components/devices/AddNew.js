import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';

function AddNew({ onDeviceAdded }) {
    const [ipAddress, setIpAddress] = useState('');
    const [name, setName] = useState(''); // Changed hostname to name
    const [vendor, setVendor] = useState('');
    const [type, setType] = useState('');
    const [version, setVersion] = useState('');
    const [gpsLatitude, setGpsLatitude] = useState('');
    const [gpsLongitude, setGpsLongitude] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Clear previous messages
        setError('');
        setSuccess(false);

        // Validate inputs
        if (!ipAddress || !name || !vendor || !type) { // Added vendor and type
            setError('IP address, name, vendor, and type are required.');
            return;
        }

        try {
            // Submit data to the API
            const response = await apiClient.post('/devices/', {
                ip_address: ipAddress,
                name, // Changed hostname to name
                vendor,
                type,
                version: version || null,
                gps_latitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
                gps_longitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
            });

            // Notify the parent about the new device
            if (onDeviceAdded) {
                onDeviceAdded(response.data);
            }

            // Reset the form and show success message
            setIpAddress('');
            setName(''); // Changed hostname to name
            setVendor('');
            setType('');
            setVersion('');
            setGpsLatitude('');
            setGpsLongitude('');
            setSuccess(true);
        } catch (err) {
            setError('Failed to add device. Please try again.');
        }
    };

    return (
        <div className="add-new-device-form">
            <h3>Add New Device</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="ipAddress">IP Address:</label>
                    <input
                        type="text"
                        id="ipAddress"
                        value={ipAddress}
                        onChange={(e) => setIpAddress(e.target.value)}
                        placeholder="Enter IP address"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="name">Name:</label>
                    <input
                        type="text"
                        id="name"
                        value={name} // Changed hostname to name
                        onChange={(e) => setName(e.target.value)} // Changed setHostname to setName
                        placeholder="Enter name"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="vendor">Vendor:</label>
                    <input
                        type="text"
                        id="vendor"
                        value={vendor}
                        onChange={(e) => setVendor(e.target.value)}
                        placeholder="Enter vendor"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="type">Type:</label>
                    <input
                        type="text"
                        id="type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        placeholder="Enter type"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="version">Version:</label>
                    <input
                        type="text"
                        id="version"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        placeholder="Enter version"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="gpsLatitude">GPS Latitude:</label>
                    <input
                        type="text"
                        id="gpsLatitude"
                        value={gpsLatitude}
                        onChange={(e) => setGpsLatitude(e.target.value)}
                        placeholder="Enter GPS Latitude"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="gpsLongitude">GPS Longitude:</label>
                    <input
                        type="text"
                        id="gpsLongitude"
                        value={gpsLongitude}
                        onChange={(e) => setGpsLongitude(e.target.value)}
                        placeholder="Enter GPS Longitude"
                    />
                </div>
                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">Device added successfully!</p>}
                <button type="submit" className="submit-button">
                    Add Device
                </button>
            </form>
        </div>
    );
}

export default AddNew;