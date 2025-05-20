import React, { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';

function InjectTraps({ devices }) {
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [jsonContent, setJsonContent] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Fetch agents from the API
    const agentOptions = devices.map(device => ({
        value: device.hostname, // This will be sent in the post request
        label: device.hostname,
        ip_address: device.ip_address  // This is what the user sees
    }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Clear previous messages
        setError('');
        setSuccess(false);

        // Validate inputs
        if (!selectedAgent || !jsonContent.trim()) {
            setError('Please select an agent and provide JSON content.');
            return;
        }

        try {
            const content = JSON.parse(jsonContent);

            // Submit SNMP trap to the API
            await apiClient.post('/traps/', {
                device: selectedAgent.ip_address,
                content,
            });

            // Reset the form and show success message
            setSelectedAgent(null);
            setJsonContent('');
            setSuccess(true);
        } catch (err) {
            setError('Failed to inject SNMP trap. Please ensure the JSON content is valid.');
        }
    };

    // Function to delete all SNMP traps
    const handleDeleteAllSnmpTraps = async () => {
        setDeleteError('');
        setDeleteSuccess(false);

        try {
            // Call the API to delete all SNMP traps
            await apiClient.delete('/snmptraps/deleteAllSnmpTraps/');
            setDeleteSuccess(true); // Show success message
        } catch (err) {
            setDeleteError('Failed to delete SNMP traps. Please try again.');
        }
    };

    // Function to delete all SNMP traps
    const handleDeleteAllSnmpTrapOids = async () => {
        setDeleteError('');
        setDeleteSuccess(false);

        try {
            // Call the API to delete all SNMP traps
            await apiClient.delete('/snmptraps/deleteAllSnmpTrapOids/');
            setDeleteSuccess(true); // Show success message
        } catch (err) {
            setDeleteError('Failed to delete SNMP trap Oids. Please try again.');
        }
    };

    // Function to delete all SNMP traps
    const handleDeleteAllSnmpOids = async () => {
        setDeleteError('');
        setDeleteSuccess(false);

        try {
            // Call the API to delete all SNMP traps
            await apiClient.delete('/snmptraps/deleteAllSnmpOids/');
            setDeleteSuccess(true); // Show success message
        } catch (err) {
            setDeleteError('Failed to delete SNMP trap Oids. Please try again.');
        }
    };


    return (
        <div className="inject-snmptrap-form">
            <h3>Inject New SNMP Trap</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="agent">Agent:</label>
                    <Select
                        options={agentOptions} // Use mapped options
                        value={selectedAgent}
                        onChange={setSelectedAgent} // Store the selected option
                        styles={customStyles}
                        placeholder="Select sending agent"
                        id="agent"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="jsonContent">JSON Content:</label>
                    <textarea
                        id="jsonContent"
                        rows="10"
                        placeholder="Type JSON content here"
                        value={jsonContent}
                        onChange={(e) => setJsonContent(e.target.value)}
                        required
                    />
                </div>

                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">SNMP trap injected successfully!</p>}

                <button type="submit" className="submit-button">
                    Inject SNMP Trap
                </button>
            </form>

            {/* Button to delete all SNMP traps */}
            <div className="delete-snmptraps">
                <button onClick={handleDeleteAllSnmpTraps} className="delete-button">
                    Delete All SNMP Traps
                </button>
                <button onClick={handleDeleteAllSnmpTrapOids} className="delete-button">
                    Delete All SNMP Trap Oids
                </button>
                <button onClick={handleDeleteAllSnmpOids} className="delete-button">
                    Delete All SNMP Oids
                </button>
                {deleteError && <p className="error-message">{deleteError}</p>}
                {deleteSuccess && <p className="success-message">All SNMP traps have been deleted successfully!</p>}
            </div>
        </div>
    );
}

export default InjectTraps;
