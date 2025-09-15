import React, { useState } from 'react';
import '../../css/Sidebar.css';
import { NavLink } from 'react-router-dom';
import { FaToggleOn, FaToggleOff } from 'react-icons/fa';
import moment from 'moment-timezone'; // Import moment-timezone
import apiClient from '../misc/AxiosConfig';
import { MdWorkspacePremium } from "react-icons/md";
import { GiLockedFortress } from "react-icons/gi";

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
    <div style={{display: 'flex'}}>
      <div className="sidebarContainer">
        <ul className="sidebarMenu">
          <li><NavLink to="/incidents" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Main Dashboard</NavLink></li>
          <li><NavLink to="/devices" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Devices</NavLink></li>
          <li><NavLink to="/signals" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Signals</NavLink></li>
          <li><NavLink to="/faults" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Faults</NavLink></li>
          <li><NavLink to="/traffic" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Traffic</NavLink></li>
          <li><NavLink to="/performance" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Performance</NavLink></li>
          <li><NavLink to="/topology" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Topology</NavLink></li>
        </ul>
      </div>
      <div className="brand"></div>
    </div>
  );
};

export default Sidebar;
