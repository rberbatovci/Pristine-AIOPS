import React, { useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '8px',
};

const defaultCenter = {
  lat: 48.5260,
  lng: 15.2551,
};

function GeolocationMap({ locations }) {
  const [currentPosition, setCurrentPosition] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting geolocation:', error);
          setCurrentPosition(defaultCenter); // fallback to default if error
        }
      );
    } else {
      console.error('Geolocation not supported');
      setCurrentPosition(defaultCenter); // fallback
    }
  }, []);

  return (
    <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
      {currentPosition && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={currentPosition}
          zoom={5}
        >
          {/* Markers for provided locations only */}
          {locations.map((location, index) => (
            <Marker
              key={index}
              position={{ lat: location.lat, lng: location.lng }}
              title={location.name}
              onClick={() => setSelectedLocation(location)}
              icon={{ url: '/favicon.ico' }}
            />
          ))}

          {/* InfoWindow when a marker is clicked */}
          {selectedLocation && (
            <InfoWindow
              position={{
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
              }}
              onCloseClick={() => setSelectedLocation(null)}
            >
              <div style={{ height: '100px', width: '300px' }}>
                <h4>{selectedLocation.name}</h4>
                <p>Latitude: {selectedLocation.lat}</p>
                <p>Longitude: {selectedLocation.lng}</p>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      )}
    </LoadScript>
  );
}

export default GeolocationMap;
