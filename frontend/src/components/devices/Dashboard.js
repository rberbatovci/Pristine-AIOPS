import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';

function Dashboard({ device, onDeviceUpdate, onDeviceDelete }) {
    const [editMode, setEditMode] = useState(false);
    const [editedDevice, setEditedDevice] = useState({ ...device });

    // Handle changes in the input fields
    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setEditedDevice((prevDevice) => ({
            ...prevDevice,
            [name]: value,
        }));
    };

    // Toggle edit mode
    const handleEditClick = () => {
        setEditMode(!editMode);
    };

    // Save edited device (API request)
    const handleSaveClick = async () => {
        try {
            // Use apiClient to send a PUT request
            const response = await apiClient.put(`/devices/devices/${editedDevice.id}/`, editedDevice);
            if (response.status === 200) {
                onDeviceUpdate(editedDevice); // Update the device state in the parent
                setEditMode(false); // Exit edit mode
            }
        } catch (error) {
            console.error('Error updating device:', error);
        }
    };

    // Handle device deletion (API request)
    const handleDeleteClick = async () => {
        try {
            // Use apiClient to send a DELETE request
            const response = await apiClient.delete(`/devices/devices/${device.id}/`);
            if (response.status === 200) {
                onDeviceDelete(device.id); // Update the device list in the parent
            }
        } catch (error) {
            console.error('Error deleting device:', error);
        }
    };

    if (!device) {
        return <div>Select a device to view details.</div>;
    }

    return (
        <div>
            <h3>Device: {editMode ? (
                <input
                    type="text"
                    name="hostname"
                    value={editedDevice.hostname}
                    onChange={handleInputChange}
                />
            ) : (
                device.hostname
            )}</h3>

            <p>
                IP Address: {editMode ? (
                    <input
                        type="text"
                        name="ip_address"
                        value={editedDevice.ip_address}
                        onChange={handleInputChange}
                    />
                ) : (
                    device.ip_address
                )}
            </p>

            <p>
                Device Status: {editMode ? (
                    <input
                        type="text"
                        name="status"
                        value={editedDevice.status}
                        onChange={handleInputChange}
                    />
                ) : (
                    device.status
                )}
            </p>

            <p>
                Device Type: {editMode ? (
                    <input
                        type="text"
                        name="type"
                        value={editedDevice.type}
                        onChange={handleInputChange}
                    />
                ) : (
                    device.type
                )}
            </p>

            <p>
                Vendor: {editMode ? (
                    <input
                        type="text"
                        name="vendor"
                        value={editedDevice.vendor}
                        onChange={handleInputChange}
                    />
                ) : (
                    device.vendor
                )}
            </p>

            <p>
                Version: {editMode ? (
                    <input
                        type="text"
                        name="version"
                        value={editedDevice.version}
                        onChange={handleInputChange}
                    />
                ) : (
                    device.version
                )}
            </p>

            <p>
                GPC Location: {editMode ? (
                    <input
                        type="text"
                        name="gps_location"
                        value={editedDevice.gps_location}
                        onChange={handleInputChange}
                    />
                ) : (
                    device.gps_location
                )}
            </p>

            <div className="deviceActions">
                {/* Edit and save buttons */}
                {editMode ? (
                    <button onClick={handleSaveClick}>Save</button>
                ) : (
                    <button onClick={handleEditClick}>Edit</button>
                )}

                {/* Delete button */}
                <button onClick={handleDeleteClick} style={{ color: 'red' }}>
                    Delete
                </button>
            </div>

            <ul>
                {/* Render other device details */}
                {device.elements ? (
                    device.elements.map((element, index) => (
                        <li key={index}>{element}</li>
                    ))
                ) : (
                    <li>No elements available</li>
                )}
            </ul>
        </div>
    );
}

export default Dashboard;
