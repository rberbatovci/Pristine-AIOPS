import React, { useState } from 'react';

function TelemetryConfig({ onSubmit }) {
    const [enabled, setEnabled] = useState(false);
    return (
        <div>
            <label>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enable Syslogs
            </label>
            <button onClick={() => onSubmit(enabled)}>Next: SNMP</button>
        </div>
    );
}

export default TelemetryConfig;
