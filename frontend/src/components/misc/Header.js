import React from 'react';
import { FaRegUserCircle } from "react-icons/fa";
import '../../css/Header.css';
import { NavLink } from 'react-router-dom';

const Header = ({ currentUser, dashboardTitle, onToggleUserProfile }) => {
  return (
    <div className="header-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '20px' }}>
        <p style={{ margin: 0 }}>
          <span style={{
            fontWeight: 'bold', margin: 0, fontSize: '20px',
            fontFamily: "'Russo One', sans-serif",
            fontWeight: 400
          }}>Pristine-AIOPS</span>
          {dashboardTitle ? <span style={{fontWeidth: 'lighter', marginLeft: '2px', fontSize: '15px', opacity: '.8'}}> /{dashboardTitle}</span> : ''}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '50px' }}>
        <p style={{ margin: 0, fontWeight: 'lighter', fontSize: '14px' }}>Hello, {currentUser.username}</p>
        <button
          onClick={onToggleUserProfile}
          style={{
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '12px',
            color: 'inherit',
            marginRight: '15px'
          }}
          aria-label="Toggle User Profile"
          title="Toggle User Profile"
        >
          <FaRegUserCircle />
        </button>
      </div>
    </div>
  );
};

export default Header;
