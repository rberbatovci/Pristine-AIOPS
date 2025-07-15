import React, { useState } from 'react';
import '../../css/Sidebar.css';
import { NavLink } from 'react-router-dom';
import { FaToggleOn, FaToggleOff } from 'react-icons/fa';
import moment from 'moment-timezone'; // Import moment-timezone
import apiClient from '../misc/AxiosConfig';

const Sidebar = ({ toggleTheme, isDarkTheme, currentUser, onLogout }) => {
  const [selectedTimezone, setSelectedTimezone] = useState(currentUser?.timezone || 'UCT');
  
  // Get the list of all timezones
  const timezones = moment.tz.names();
  console.log('Selected Timezone from currentUser', currentUser);
  // Handle timezone change
  const handleTimezoneChange = async (event) => {
    const newTimezone = event.target.value;
    setSelectedTimezone(newTimezone);

    try {
      // Use apiClient for the API request
      const response = await apiClient.post('/profiles/update-timezone/', {
        timezone: newTimezone,
      });

      if (response.status === 200) {
        console.log('Timezone updated successfully');
      } else {
        console.error('Failed to update timezone');
      }
    } catch (error) {
      console.error('Error updating timezone:', error);
    }
  };

  return (
    <div className="sidebarContainer">
      <ul className="sidebarMenu">
        <li><NavLink to="/incidents" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Incidents Dashboard</NavLink></li>
        <li><NavLink to="/signalsdashboard" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Signals Dashboard</NavLink></li>
        <li><NavLink to="/events" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Events Database</NavLink></li>
        <li><NavLink to="/statistics" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Signals Summary</NavLink></li>
        <li><NavLink to="/devices" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Devices</NavLink></li>
        <li><NavLink to="/geolocation" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Geolocation</NavLink></li>
      </ul>
    </div>
  );
};

export default Sidebar;
