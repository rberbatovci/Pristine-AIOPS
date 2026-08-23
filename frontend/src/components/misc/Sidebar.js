import { useState } from 'react';
import '../../css/Sidebar.css';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <div style={{display: 'flex'}}>
      <div className="sidebarContainer">
        <ul className="sidebarMenu">
          <li><NavLink to="/incidents" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Incidents</NavLink></li>
          <li><NavLink to="/devices" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Devices</NavLink></li>
          <li><NavLink to="/signals/syslogs/table" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Signals</NavLink></li>
          <li><NavLink to="/events/syslogs/table" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Faults</NavLink></li>
          <li><NavLink to="/traffic/table" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Traffic</NavLink></li>
          <li><NavLink to="/performance" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Performance</NavLink></li>
          <li><NavLink to="/topology/table" className={({ isActive }) => isActive ? 'selSidebarPage' : 'sidebarPage'}>Topology</NavLink></li>
        </ul>
      </div>
      <div className="brand"></div>
    </div>
  );
};

export default Sidebar;
