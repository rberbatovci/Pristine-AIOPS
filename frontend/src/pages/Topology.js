import React, { useState, useEffect } from 'react';
import GeolocationMap from '../components/geolocation/GeolocationMap';
import '../css/Topology.css';

function Topology({ keycloak, currentUser, setDashboardTitle }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    setDashboardTitle("Topology");
    return () => setDashboardTitle('');
  }, [setDashboardTitle]);

  return (
    <div className="mainContainer">
      <div className="mainContainerHeader">
        <div className="mainContainerButtons">
          <div className="headerButtons">
            {currentUser.is_staff && (
              <button className="headerButton">Settings</button>
            )}
          </div>
        </div>
      </div>
      <div className="mainGeolocationContent" style={{ padding: '10px' }}>
        <GeolocationMap locations={locations} />
      </div>
    </div>
  );
}

export default Topology;
