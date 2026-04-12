import { useState, useEffect } from 'react';
import kcFetch from '../../misc/kcFetch'; 
import { useSyslogSeverity } from '../../../hooks/useSyslogSeverity';

const SyslogSeverity = ({ keycloak }) => {
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

  // ✅ use the hook
  const { severity, loading, error, reload } = useSyslogSeverity(keycloak);

  const [activeSeverity, setActiveSeverity] = useState(null);
  const [description, setDescription] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // ✅ sync hook data into local state
  useEffect(() => {
    if (severity) {
      setActiveSeverity(Number(severity.number));
      setDescription(severity.description || '');
    }
  }, [severity]);

  // ✅ detect 404 if you still want create mode
  useEffect(() => {
    if (error?.message?.startsWith("HTTP 404")) {
      setShowCreateForm(true);
    }
  }, [error]);

  const handleUpdate = async () => {
    if (activeSeverity === null) {
      alert("Please select a severity level.");
      return;
    }

    const selected = severityOptions.find(
      option => option.value === activeSeverity
    );

    if (!selected) {
      alert("Selected severity not found.");
      return;
    }

    try {
      await kcFetch(keycloak, "/syslogs/severity", {
        method: "PUT",
        body: JSON.stringify({
          number: selected.value,
          severity: selected.label,
          description,
        }),
      });

      alert("Severity and description updated successfully!");

      // ✅ refresh from backend
      reload();
    } catch (error) {
      console.error("Error updating severity and description:", error);
      alert("Failed to update severity and description.");
    }
  };

  return (
    <div className="signalConfigRuleContainer" style={{ margin: '10px' }}>
      {loading ? (
        <div className="signalConfigRuleMessage">
          Loading syslog severity config. Please wait...
        </div>
      ) : error && !showCreateForm ? (
        <div className="signalConfigRuleMessage">
          Failed to load syslog severity. Please try again later.
        </div>
      ) : (
        <>
          <div style={{
            background: 'var(--backgroundColor3)',
            borderRadius: '5px',
            color: 'var(--textColor)',
            padding: '10px',
            paddingLeft: '15px'
          }}>
            <div style={{ marginBottom: '10px' }}>
              <span>Syslogs Severity Levels:</span>
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
              {severityOptions.map(({ label, value }) => {
                const isActive = value <= (activeSeverity ?? -1);
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
                      width: 'calc(100% - 20px)',
                      padding: '10px',
                      borderRadius: '5px',
                      border: '1px solid var(--borderColor)',
                      background: 'var(--buttonBackground)',
                    }}
                  />
                </div>

                <div className="signalConfigButtonContainer" style={{ marginLeft: '10px' }}>
                  <button
                    onClick={handleUpdate}
                    className="addRuleButton"
                    style={{ width: '100%' }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SyslogSeverity;