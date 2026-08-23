import React, { useEffect } from 'react';
import {
  PiUserDuotone,
  PiSunDuotone,
  PiMoonDuotone,
  PiSignOutDuotone,
  PiGlobeDuotone
} from "react-icons/pi";
import '../../css/UserProfileModern.css';
import { useUserPreferences } from "../../hooks/useUserPreferences";

// Dynamically generate all standard IANA time zones supported by the browser
const ALL_TIMEZONES = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo'];

const UserProfile = ({ keycloak, currentUser, setIsDarkTheme, onLogout, isDarkTheme }) => {
  const { preferences, updateTheme, updateTimezone } = useUserPreferences(keycloak);

  // Sync parent theme state when backend preferences load
  useEffect(() => {
    if (preferences?.theme) {
      setIsDarkTheme(preferences.theme === 'dark');
    }
  }, [preferences?.theme, setIsDarkTheme]);

  const toggleTheme = () => {
    const newTheme = isDarkTheme ? "light" : "dark";
    setIsDarkTheme(newTheme === "dark");
    updateTheme(newTheme);
  };

  const handleTimezoneChange = (e) => {
    const selectedZone = e.target.value;
    updateTimezone(selectedZone);
  };

  return (
    <div className="cpu-monitor-card profile-card-wrapper"> 
      <div className="chart-container profile-avatar-container">
        <div className="profile-avatar-circle">
          <PiUserDuotone className="avatar-icon" />
          <span className="status-dot text-healthy avatar-online-indicator"></span>
        </div>
      </div> 

      <div className="metrics-sidebar profile-content-sidebar">
        <div className="sidebar-header">
          <h4>Operator Profile</h4>
          <span className="timestamp-badge">Role: System Administrator</span>
        </div> 

        <div className="profile-identity-info">
          <span className="profile-username">{currentUser?.username || 'Operator Node'}</span>
          <span className="profile-email">{currentUser?.email || 'noc@infrastructure.local'}</span>
        </div> 

        <div className="telemetry-rows profile-control-rows"> 
          {/* Theme Row */}
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

          {/* Timezone Selector Row */}
          <div className="metric-row control-interactive-row selector-row">
            <div className="metric-meta">
              <PiGlobeDuotone className="control-icon text-healthy" />
              <span className="metric-label">Active Zone</span>
            </div>
            <div className="metric-value">
              <select
                value={preferences.timezone || 'UTC'}
                onChange={handleTimezoneChange}
                className="timezone-native-select"
              >
                {ALL_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div> 

          {/* Logout Row */}
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