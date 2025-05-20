import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';

function InjectSyslogs({ devices }) {
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [syslogMessage, setSyslogMessage] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    //console.log('Agent hostnames in InjectData:', agents);

    // Map agents to Select options
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
        if (!selectedAgent || !syslogMessage) {
            setError('Both agent and syslog message are required.');
            return;
        }
    
        try {
            // Submit syslog to the API
            await apiClient.post('/syslogs/', {
                device: selectedAgent.ip_address,  // Send IP instead of hostname
                message: syslogMessage,
            });
    
            // Reset the form and show success message
            setSelectedAgent(null);
            setSyslogMessage('');
            setSuccess(true);
        } catch (err) {
            setError('Failed to inject syslog. Please try again.');
        }
    };

    const handleDeleteAllSyslogs = async () => {
        // Clear previous messages
        setError('');
        setSuccess(false);

        if (!window.confirm('Are you sure you want to delete all syslog entries? This action cannot be undone.')) {
            return;
        }

        try {
            // Call the API to delete all syslog entries
            await apiClient.delete('/syslogs/delete-syslogs/');
            setSuccess(true);
        } catch (err) {
            setError('Failed to delete all syslog entries. Please try again.');
        }
    };

    const handleDeleteAllMnemonics = async () => {
        // Clear previous messages
        setError('');
        setSuccess(false);

        if (!window.confirm('Are you sure you want to delete all syslog entries? This action cannot be undone.')) {
            return;
        }
        try {
            // Call the API to delete all syslog entries
            await apiClient.delete('/syslogs/delete-mnemonics/');
            setSuccess(true);
        } catch (err) {
            setError('Failed to delete all syslog entries. Please try again.');
        }
    };

    return (
        <div className="inject-syslog-form">
            <h3>Inject New Syslog</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="agent">Sending Agent:</label>
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
                    <label htmlFor="syslogMessage">Syslog Message:</label>
                    <textarea
                        id="syslogMessage"
                        value={syslogMessage}
                        onChange={(e) => setSyslogMessage(e.target.value)}
                        placeholder="Enter syslog message"
                        required
                        rows="4"
                    />
                </div>
                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">Operation successful!</p>}
                <button type="submit" className="submit-button">
                    Inject Syslog
                </button>
                <button
                    type="button"
                    className="delete-button"
                    onClick={handleDeleteAllSyslogs}
                >
                    Delete All Syslogs
                </button>
                <button
                    type="button"
                    className="delete-button"
                    onClick={handleDeleteAllMnemonics}
                >
                    Delete All Mnemonics
                </button>
            </form>
        </div>
    );
}

export default InjectSyslogs;
