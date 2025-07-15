import React, { useState, useEffect, useRef } from 'react';

const UserProfile = ({ currentUser, onLogout, toggleTheme, isDarkTheme }) => {

  return (
    <div>
      <p><strong>{currentUser?.username || 'User'}</strong></p>
      <p>{currentUser?.email}</p>

      <button onClick={toggleTheme} className="profile-button">
        Switch to {isDarkTheme ? 'Light' : 'Dark'} Theme
      </button>

      <button onClick={onLogout} className="profile-button logout">
        Logout
      </button>
    </div>
  );
};

export default UserProfile;
