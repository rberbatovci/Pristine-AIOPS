import React, { useState } from 'react';
import { 
  PiUserDuotone, 
  PiSunDuotone, 
  PiMoonDuotone, 
  PiSignOutDuotone, 
  PiGlobeDuotone 
} from "react-icons/pi";
import '../../css/UserProfileModern.css'; // Path to the new CSS file

const UserProfile = ({ currentUser, onLogout, toggleTheme, isDarkTheme }) => {
  // Common operational timezones for a tech dashboard
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  return (
    <div className="cpu-monitor-card profile-card-wrapper">
      
      {/* Visual Avatar Frame Space */}
      <div className="chart-container profile-avatar-container">
        <div className="profile-avatar-circle">
          <PiUserDuotone className="avatar-icon" />
          <span className="status-dot text-healthy avatar-online-indicator"></span>
        </div>
      </div>

      {/* Profile Details & Configuration Control Fields */}
      <div className="metrics-sidebar profile-content-sidebar">
        <div className="sidebar-header">
          <h4>Operator Profile</h4>
          <span className="timestamp-badge">
            Role: System Administrator
          </span>
        </div>

        <div className="profile-identity-info">
          <span className="profile-username">{currentUser?.username || 'Operator Node'}</span>
          <span className="profile-email">{currentUser?.email || 'noc@infrastructure.local'}</span>
        </div>

        <div className="telemetry-rows profile-control-rows">
          
          {/* Theme Toggle Feature Row */}
          <div className="metric-row control-interactive-row" onClick={toggleTheme}>
            <div className="metric-meta">
              {isDarkTheme ? (
                <PiSunDuotone className="control-icon text-warning" />
              ) : (
                <PiMoonDuotone className="control-icon text-healthy" />
              )}
              <span className="metric-label">Display Theme</span>
            </div>
            <div className="metric-value toggle-display-text">
              {isDarkTheme ? 'LIGHT MODE' : 'DARK MODE'}
            </div>
          </div>

          {/* Timezone Configuration Dropdown Row */}
          <div className="metric-row control-interactive-row selector-row">
            <div className="metric-meta">
              <PiGlobeDuotone className="control-icon text-healthy" />
              <span className="metric-label">Active Zone</span>
            </div>
            <div className="metric-value">
              <select 
                value={timezone} 
                onChange={(e) => setTimezone(e.target.value)}
                className="timezone-native-select"
              >
                <option value="UTC">UTC (Zulu)</option>
                <option value="America/New_York">EST / EDT</option>
                <option value="America/Chicago">CST / CDT</option>
                <option value="America/Denver">MST / MDT</option>
                <option value="America/Los_Angeles">PST / PDT</option>
                <option value="Europe/London">GMT / BST</option>
                <option value="Europe/Paris">CET / CEST</option>
                <option value="Asia/Tokyo">JST (Tokyo)</option>
              </select>
            </div>
          </div>

          {/* Explicit Sign-Out Destruction Action Row */}
          <div className="metric-row control-interactive-row logout-trigger-row" onClick={onLogout}>
            <div className="metric-meta">
              <PiSignOutDuotone className="control-icon text-critical" />
              <span className="metric-label logout-label">Terminate Session</span>
            </div>
            <div className="metric-value text-critical monospace-data">
              LOGOUT
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default UserProfile;