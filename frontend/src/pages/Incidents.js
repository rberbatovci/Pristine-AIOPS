import React, { useEffect } from 'react';
import '../css/Signals.css';

const Incidents = ({ currentUser, setDashboardTitle }) => {

    useEffect(() => {
        setDashboardTitle("Incidents Dashboard");
        return () => setDashboardTitle(''); 
    }, [setDashboardTitle]);

    return (
        <div className="signals-container" style={{ width: '50%' }}>
            <div style={{ display: 'flex', width: '100%', marginTop: '10px',marginLeft: '10px', marginRight: '10px', marginBottom: '5px', background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', height: 'calc(100vh - 130px)', overflowY: 'auto' }}>
                UNDER CONSTRUCTION
            </div>
        </div>
    );
};

export default Incidents;
