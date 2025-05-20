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
        const response = await apiClient.get('/syslogsignals/syslogsignalseverity/');
        const data = response.data;

        if (Array.isArray(data)) {
          if (data.length === 0) {
            // Empty list: no config
            setShowCreateForm(true);
          } else {
            const { number, severity, description } = data[0];
            setActiveSeverity(number);
            setDescription(description);
            setShowCreateForm(false);
          }
        } else if (typeof data === 'object' && data !== null) {
          if (data.detail === "NoConfig") {
            setShowCreateForm(true);
          } else {
            // Single object
            const { severity_level, description } = data;
            setActiveSeverity(severity_level);
            setDescription(description);
            setShowCreateForm(false);
          }
        } else {
          setError('Unexpected response format.');
        }
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
      await apiClient.put('/syslogsignals/syslogsignalseverity/', {
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
    <div className="signalConfigRuleContainer">
      {isLoading ? (
        <div className="signalConfigRuleMessage">Loading syslog severity config. Please wait...</div>
      ) : error ? (
        <div className="signalConfigRuleMessage">{error}</div>
      ) : showCreateForm ? (
        <div>
          <div style={{padding: '10px'}}>No configuration found. Please create a new configuration.</div>
          <div style={{ background: 'var(--backgroundColor3)', borderRadius: '5px', color: 'var(--textColor)', padding: '10px', paddingLeft: '15px', height: '170px' }}>
            <div style={{ marginBottom: '10px', top: '10px' }}>
              <span>Syslogs Severity Levels:</span>
            </div>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', width: '90px' }}>
                {severityOptions.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setActiveSeverity(value)}
                    onMouseEnter={() => setHoveredSeverity(value)}
                    onMouseLeave={() => setHoveredSeverity(null)}
                    className={`button ${activeSeverity === value ? 'button-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <span>Description:</span>
              <div>
                <input
                  type="text"
                  placeholder="Enter description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '83%',
                    padding: '10px',
                    borderRadius: '5px',
                    border: '1px solid var(--borderColor)',
                    background: 'var(--buttonBackground)',
                  }}
                />
                <button onClick={handleUpdate} className="update-button">
                  Create
                </button>
              </div>
              <div className="signalConfigButtonContainer">
                
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ background: 'var(--backgroundColor3)', borderRadius: '5px', color: 'var(--textColor)', padding: '10px', paddingLeft: '15px' }}>
            <div style={{ marginBottom: '10px', top: '10px' }}>
              <strong>Syslogs Severity Levels:</strong>
            </div>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', width: '90px' }}>
                {severityOptions.map(({ label, value }) => {
                  const isActive = value <= Math.max(activeSeverity ?? -1, hoveredSeverity ?? -1);
                  return (
                    <button
                      key={value}
                      onClick={() => setActiveSeverity(value)}
                      onMouseEnter={() => setHoveredSeverity(value)}
                      onMouseLeave={() => setHoveredSeverity(null)}
                      className={`button ${isActive ? 'button-active' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column' }}>
              <strong style={{ marginBottom: '5px' }}>Description:</strong>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ marginTop: '5px', flexGrow: 1 }}>
                  <input
                    type="text"
                    placeholder="Enter description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: 'calc(100% - 100px)', /* Adjust width to accommodate the button */
                      padding: '10px',
                      borderRadius: '5px',
                      border: '1px solid var(--borderColor)',
                      background: 'var(--buttonBackground)',
                    }}
                  />
                </div>
                <div className="signalConfigButtonContainer" style={{ marginLeft: '10px' }}>
                  <button onClick={handleUpdate} className="update-button">
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
