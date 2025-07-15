import React, { useState, useEffect } from 'react';
import apiClient from '../components/misc/AxiosConfig';
import GeolocationMap from '../components/geolocation/GeolocationMap';
import '../css/Geolocation.css';

function Geolocation({ currentUser, setDashboardTitle }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    setDashboardTitle("Geolocation");
    return () => setDashboardTitle(''); // Clean up when navigating away
  }, [setDashboardTitle]);

  // Fetch device data with GPS locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await apiClient.get('/devices/'); // Fetch devices
        const devices = response.data;

        const testLocations = [
          { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
          { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
          { lat: 40.7128, lng: -74.0060, name: 'New York' },
          { lat: 51.5074, lng: -0.1278, name: 'London' },
          { lat: 35.6895, lng: 139.6917, name: 'Tokyo' },
          { lat: 42.6629, lng: 21.1655, name: 'Pristina' },
        ];

        setLocations(testLocations);
      } catch (error) {
        console.error('Error fetching device locations:', error);
      }
    };

    fetchLocations();
  }, []);

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

export default Geolocation;
