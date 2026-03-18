import React, { useState, useRef, useEffect } from 'react';
import '../css/Signals.css';

const Incidents = ({ currentUser, setDashboardTitle, keycloak }) => {
    const [showComponents, setShowComponents] = useState(false);

    useEffect(() => {
        setDashboardTitle("Signals Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    return (
        <div className="signals-container" style={{ display: 'flex', width: showComponents ? '90%' : '40%', transition: 'width 1s ease' }}>
            <div
                style={{
                    width: showComponents ? '40%' : '100%',
                    transition: 'width 1s ease-in-out, opacity 1s ease-in-out',
                    overflow: 'hidden',
                    height: '100vh',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>

                </div>
                <div style={{ marginTop: '10px', marginLeft: '10px', marginRight: '10px', marginBottom: '5px', background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', height: 'calc(100vh - 150px)', overflowY: 'auto' }}>
                    We're still under construction!!!
                </div>
            </div>
        </div>
    );
};

export default Incidents;