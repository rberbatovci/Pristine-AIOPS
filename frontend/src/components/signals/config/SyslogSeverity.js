import React, { useState, useEffect } from 'react';
import apiClient from '../../misc/AxiosConfig';
import './SignalConfigElement.css'; // Import your CSS file

const SyslogSeverity = () => {
  const severityOptions = [
    { label: "Emergency", value: 0 },
    { label: "Alert", value: 1 },
    { label: "Critical", value: 2 },
    { label: "Error", value: 3 },
    { label: "Warning", value: 4 },
    { label: "Notice", value: 5 },
    { label: "Informational", value: 6 },
    { label: "Debugging", value: 7 },
  ];

  const [activeSeverity, setActiveSeverity] = useState(null);
  const [description, setDescription] = useState('');
  const [hoveredSeverity, setHoveredSeverity] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    const fetchSyslogSeverity = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.get('/syslogs/severity/');
        setActiveSeverity(Number(response.data.number));
        setDescription(response.data.description);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          setShowCreateForm(true);
        } else {
          console.error('Fetch error:', error);
          setError('Failed to load syslog severity. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSyslogSeverity();
  }, []);

  const handleUpdate = async () => {
    if (activeSeverity === null) {
      alert("Please select a severity level.");
      return;
    }

    const selected = severityOptions.find(option => option.value === activeSeverity);
    if (!selected) {
      alert("Selected severity not found.");
      return;
    }

    try {
      await apiClient.put('/syslogs/severity/', {
        number: selected.value,
        severity: selected.label,
        description
      });
      alert('Severity and description updated successfully!');
    } catch (error) {
      console.error('Error updating severity and description:', error);
      alert('Failed to update severity and description.');
    }
  };

  return (
    <div className="signalConfigRuleContainer" style={{ margin: '10px' }}>
      {isLoading ? (
        <div className="signalConfigRuleMessage">Loading syslog severity config. Please wait...</div>
      ) : error ? (
        <div className="signalConfigRuleMessage">{error}</div>
      ) : (
        <>
          <div style={{ background: 'var(--backgroundColor3)', borderRadius: '5px', color: 'var(--textColor)', padding: '10px', paddingLeft: '15px' }}>
            <div style={{ marginBottom: '10px', top: '10px' }}>
              <span>Syslogs Severity Levels:</span>
            </div>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', width: '100%' }}>
                {severityOptions.map(({ label, value }) => {
                  const isActive = value <= (activeSeverity ?? -1); // highlight up to API value
                  return (
                    <button
                      key={value}
                      onClick={() => setActiveSeverity(value)}
                      className={`syslogSeverityX ${isActive ? 'selectedSyslogSeverityX' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ marginBottom: '5px' }}>Description:</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ marginTop: '10px', flexGrow: 1 }}>
                  <input
                    type="text"
                    placeholder="Enter description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: 'calc(100% - 20px)', /* Adjust width to accommodate the button */
                      padding: '10px',
                      borderRadius: '5px',
                      border: '1px solid var(--borderColor)',
                      background: 'var(--buttonBackground)',
                    }}
                  />
                </div>
                <div className="signalConfigButtonContainer" style={{ marginLeft: '10px' }}>
                  <button onClick={handleUpdate} className="addRuleButton" style={{ width: '100%' }}>
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )
      }
    </div >
  );
};

export default SyslogSeverity;
