import React, { useState } from 'react';

function TelemetryConfig({ onSubmit }) {
    const [enabled, setEnabled] = useState(false);
    return (
        <div className="searchSyslogsContainer" style={{zIndex: '1'}}>
            <span className="searchSignalFilterText">Configure telemetry</span>
            <div className="searchSyslogsFilterEntries" style={{ marginTop: '5px' }}>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">CPU Utilization:</span>
                    <button style={{ marginTop: '6px' }}>
                        Run
                    </button>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Memory Statistics:</span>
                    <button style={{ marginTop: '6px' }}>
                        Run
                    </button>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Interface Statistics:</span>
                    <button style={{ marginTop: '6px' }}>
                        Run
                    </button>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">BGP Connections:</span>
                    <button style={{ marginTop: '6px' }}>
                        Run
                    </button>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">ISIS Statistics:</span>
                    <button style={{ marginTop: '6px' }}>
                        Run
                    </button>
                </div>
                <div className="searchSyslogsFilterEntry">
                    <span className="searchSignalFilterText">Minimum Severity:</span>
                    <button style={{ marginTop: '6px' }}>
                        Run
                    </button>
                </div>
            </div>




        </div>
    );
}

export default TelemetryConfig;
