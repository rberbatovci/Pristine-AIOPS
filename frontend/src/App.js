import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { lightThemeOptions, darkThemeOptions } from "./components/misc/ParticleOptions";
import "./App.css";
import Login from "./components/misc/Login";
import Header from "./components/misc/Header";
import Sidebar from "./components/misc/Sidebar";
import FilterDevice from "./components/misc/filterDevice";
import UserProfile from "./components/misc/UserProfile";
import Notification from "./components/misc/Notification";
import ProtectedRoute from "./components/misc/ProtectedRoute";
import SearchTime from './components/misc/SearchTime.js';
import { useUserPreferences } from "./hooks/useUserPreferences";

import Incidents from "./pages/Incidents";
import Signals from "./pages/Signals";
import Devices from "./pages/Devices";
import Faults from "./pages/Faults";
import Traffic from "./pages/Traffic";
import Performance from "./pages/Performance";
import Topology from "./pages/Topology";
import SyslogEvents from "./pages/SyslogEvents";

import AddNew from './components/devices/AddNew';
import Nmap from './components/devices/Nmap';
import DeviceSettings from './components/devices/Settings';
import FilterTraffic from './components/netflow/FilterTraffic.js';

import SyslogEventFilters from "./components/faults/syslogs/Filters.js";
import Mnemonics from "./components/faults/syslogs/Mnemonics.js";
import RegularExpressions from "./components/faults/syslogs/RegEx.js";
import SyslogEventsTags from "./components/faults/syslogs/Tags.js";
import SyslogEventsTable from "./components/faults/syslogs/Table.js";
import SyslogEventsStatistics from "./components/faults/syslogs/Statistics.js";
import SyslogEventTableTags from "./components/faults/syslogs/TableTags.js";
import SyslogEventStatisticTags from "./components/faults/syslogs/StatisticTags.js";

import SnmpTrapEventTable from "./components/faults/snmptraps/Table.js";
import SnmpTrapEventStatistics from "./components/faults/snmptraps/Statistics.js";
import SnmpTrapEventTags from "./components/faults/snmptraps/Tags.js";
import SnmpTrapOids from "./components/faults/snmptraps/OIDs.js";
import SnmpTrapTagConfig from "./components/faults/snmptraps/Tag-Config.js";
import MIBs from "./components/faults/snmptraps/MIBs.js";
import SnmpTrapEventFilters from "./components/faults/snmptraps/Filters.js";
import SnmpTrapEventTableTags from "./components/faults/snmptraps/TableTags.js";
import SnmpTrapEventStatisticTags from "./components/faults/snmptraps/StatisticTags.js";


import TrafficTable from './components/netflow/Table.js';
import TrafficStatistics from './components/netflow/Statistics.js';

import SyslogSignalTable from "./components/signals/syslogs/Table.js";
import SyslogSignalStatistics from "./components/signals/syslogs/Statistics.js";
import SyslogSignalFilters from "./components/signals/syslogs/Filters.js";
import StatefulSyslogRules from "./components/signals/syslogs/StatefulRules.js";
import SyslogSignalTags from "./components/signals/syslogs/Tags.js";
import SyslogSignalSeverity from "./components/signals/syslogs/Severity.js";
import SyslogSignalTableTags from "./components/signals/syslogs/TableTags.js";
import SyslogSignalStatisticTags from "./components/signals/syslogs/StatisticTags.js";

import SnmpTrapSignalTable from "./components/signals/snmptraps/Table.js";
import SnmpTrapSignalStatistics from "./components/signals/snmptraps/Statistics.js";
import SnmpTrapSignalFilters from "./components/signals/snmptraps/Filters.js";
import StatefulSnmpTrapRules from "./components/signals/snmptraps/StatefulRules.js";
import SnmpTrapSignalTags from "./components/signals/snmptraps/Tags.js";
import SnmpTrapSignalTableTags from "./components/signals/snmptraps/TableTags.js";
import SnmpTrapSignalStatisticTags from "./components/signals/snmptraps/StatisticTags.js";

import TelemetrySignalTable from './components/signals/telemetry/Table.js';
import TelemetrySignalStatistics from './components/signals/telemetry/Statistics.js';

const App = ({ keycloak, keycloakAuthenticated }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    keycloak.authenticated || false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activePopup, setActivePopup] = useState(null);
  const popupRef = useRef(null);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const containerRef = useRef(null);
  const [init, setInit] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [syslogTags, setSyslogTags] = useState([]);
  const [selSyslogEventsTableTags, setSelSyslogEventsTableTags] = useState([]);
  const [selSyslogSignalTableTags, setSelSyslogSignalTableTags] = useState([]);
  const [selSnmpTrapSignalTableTags, setSelSnmpTrapSignalTableTags] = useState([]);
  const [selSnmpTrapEventsTableTags, setSelSnmpTrapEventsTableTags] = useState([]);
  const [selSyslogEventsStatisticsTags, setSelSyslogEventsStatisticsTags] = useState([]);
  const [selSnmpTrapEventsStatisticsTags, setSelSnmpTrapEventsStatisticsTags] = useState([]);
  const [selSyslogSignalStatisticTags, setSelSyslogSignalStatisticTags] = useState([]);
  const [selSnmpTrapSignalStatisticTags, setSelSnmpTrapSignalStatisticTags] = useState([]);
  const [snmpTrapTags, setSnmpTrapTags] = useState([]);
  const [dataSource, setDataSource] = useState("syslogs");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [devicesRefreshKey, setDevicesRefreshKey] = useState(0);
  const { preferences, loading: preferencesLoading, updateTheme, updateTimezone, reload: reloadPreferences } = useUserPreferences(keycloak);

  useEffect(() => {
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const data = keycloak.tokenParsed;

      setCurrentUser(prev => ({
        username: data.preferred_username,
        email: data.email,
        name: data.name || data.preferred_username,
        roles: data.realm_access?.roles || [],
        theme: preferences?.theme || "light",
        timezone: preferences?.timezone || "UTC"
      }));
      console.log("Current User:", currentUser);
      setIsAuthenticated(true);
    }
  }, [keycloak, preferences]);

  const handleTimeRangeChange = (start, end) => {
    setStartTime(start);
    setEndTime(end);
  };

  const toggleTheme = () => {
    const newTheme = currentUser?.theme === "dark" ? "light" : "dark";

    // 1. Update the current user state
    setCurrentUser(prev => ({
      ...prev,
      theme: newTheme
    }));

    // 2. Fix: Keep the local boolean state synchronized!
    setIsDarkTheme(newTheme === "dark");

    // 3. Persist via your hook
    updateTheme(newTheme);
  };

  const handleGuestLogin = () => {
    setIsAuthenticated(true);
    setCurrentUser({
      username: "guest",
      name: "Guest User",
      roles: []
    });
  };

  const handleLogout = () => {
    if (keycloak.authenticated) {
      keycloak.logout();
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    localStorage.setItem(
      "isAuthenticated",
      "false"
    );
  };

  useEffect(() => {
    if (!init) {
      initParticlesEngine(async engine => {
        await loadFull(engine);
        setInit(true);
      });
    }

  }, [init]);

  const togglePopup = popupName => {
    setActivePopup(prev =>
      prev === popupName ? null : popupName
    );
  };

  useEffect(() => {
    const handleClickOutside = e => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target)
      ) {
        setActivePopup(null);
      }
    };

    if (activePopup) {
      document.addEventListener(
        "mousedown",
        handleClickOutside
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };

  }, [activePopup]);

  useEffect(() => {
    const handleEsc = e => {
      if (e.key === "Escape") {
        setActivePopup(null);
      }
    };

    document.addEventListener(
      "keydown",
      handleEsc
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEsc
      );
    };

  }, []);

  const options = useMemo(() => {
    const isDark = currentUser?.theme === "dark";

    return isDark
      ? darkThemeOptions
      : lightThemeOptions;
  }, [currentUser?.theme]);

  const particlesLoaded = useCallback(container => {
    containerRef.current = container;
  }, []);


  const showNotification = (
    message,
    type = "info"
  ) => {

    setNotification({
      message,
      type
    });
  };

  const onDeviceDeselect = () => {
    console.log("Device deselected");
  };

  const onDeviceDelete = async (deviceId) => {
    console.log("Device deleted:", deviceId);
  };

  const onConfig = async (deviceId) => {
    console.log("Configuring device:", deviceId);
  };

  const handleDeviceAdded = () => {
    setDevicesRefreshKey(prev => prev + 1);
  };

  const renderPopup = () => {

    switch (activePopup) {

      case "filter-syslog-signals":
        return (
          <div className="menuOption" style={{ width: '300px' }} >
            <SyslogSignalFilters keycloak={keycloak} onSelectedSyslogFiltersChange={handleFiltersChange} />
          </div>
        );
      case "filter-snmptrap-signals":
        return (
          <div className="menuOption" >
            <SnmpTrapSignalFilters keycloak={keycloak} onSelectedTagsSearch={handleSearchAndCloseDropdown} />
          </div>
        );
      case "filter-syslog-events":
        return (
          <div className="menuOption" style={{ width: '300px' }}>
            <SyslogEventFilters keycloak={keycloak} onSelectedSyslogFiltersChange={handleFiltersChange} />
          </div>
        );
      case "filter-snmptrap-events":
        return (
          <div className="menuOption" >
            <SnmpTrapEventFilters keycloak={keycloak} onSelectedTagsSearch={handleSearchAndCloseDropdown} />
          </div>
        );
      case "syslog-event-table-tags":
        return (
          <div className="menuOption" style={{ width: '300px' }}>
            <SyslogEventTableTags tags={syslogTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "syslog-event-statistics-tags":
        return (
          <div className="menuOption" style={{ width: '300px' }}>
            <SyslogEventStatisticTags tags={syslogTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "syslog-signal-table-tags":
        return (
          <div className="menuOption" style={{ width: '300px' }} >
            <SyslogSignalTableTags tags={syslogTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "syslog-signal-statistics-tags":
        return (
          <div className="menuOption" style={{ width: '300px' }} >
            <SyslogSignalStatisticTags tags={syslogTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "snmptrap-event-table-tags":
        return (
          <div className="menuOption" >
            <SnmpTrapEventTableTags tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "snmptrap-event-statistics-tags":
        return (
          <div className="menuOption" >
            <SnmpTrapEventStatisticTags tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "snmptrap-signal-table-tags":
        return (
          <div className="menuOption" >
            <SnmpTrapSignalTableTags tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "snmptrap-signal-statistic-tags":
        return (
          <div className="menuOption" >
            <SnmpTrapSignalStatisticTags tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "timerange":
        return (
          <div className="menuOption" >
            <SearchTime startTime={startTime} endTime={endTime} onTimeRangeChange={handleTimeRangeChange} />
          </div>
        );
      case "snmpTrapMibs":
        return (
          <div className="menuOption" >
            <MIBs keycloak={keycloak} currentUser={currentUser} showNotification={showNotification} />
          </div>
        );
      case "snmpTrapOids":
        return (
          <div className="menuOption" >
            <SnmpTrapOids keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "snmpTrapTagConfig":
        return (
          <div className="menuOption" >
            <SnmpTrapTagConfig keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "mnemonics":
        return (
          <div className="menuOption" >
            <Mnemonics keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "scan-network":
        return (
          <div className="menuOption" style={{ width: '400px' }} >
            <Nmap keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "add-device":
        return (
          <div className="menuOption" style={{ width: '400px' }} >
            <AddNew keycloak={keycloak} showNotification={showNotification} onDeviceAdded={handleDeviceAdded} />
          </div>
        );
      case "device-settings":
        return (
          <div style={{ display: 'flex', position: 'absolute', top: '60px', right: '20px', zIndex: '700' }} >
            <DeviceSettings
              selectedDevice={selectedDevice}
              onConfig={onConfig}
              onDeviceDelete={onDeviceDelete}
              onDeviceDeselect={onDeviceDeselect}
              showNotification={showNotification}
              keycloak={keycloak}
            />
          </div>
        );
      case "filter-device":
        return (
          <div className="userProfile" >
            <FilterDevice
              onDeviceSelect={setSelectedDevice}
              keycloak={keycloak}
            />
          </div>
        );
      case "syslog-signals-severity":
        return (
          <div className="userProfile" >
            <SyslogSignalSeverity keycloak={keycloak} />
          </div>
        );
      case "stateful-syslog-rules":
        return (
          <div className="userProfile" >
            <StatefulSyslogRules keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "stateful-snmptrap-rules":
        return (
          <div className="userProfile" >
            <StatefulSnmpTrapRules keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "syslog-regexes":
        return (
          <div className="userProfile" >
            <RegularExpressions keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "syslog-mnemonics":
        return (
          <div className="userProfile" >
            <Mnemonics keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "snmptrap-mibs":
        return (
          <div className="userProfile" >
            <MIBs keycloak={keycloak} currentUser={currentUser} showNotification={showNotification} />
          </div>
        );
      case "snmptrap-event-tags":
        return (
          <div className="userProfile" >
            <SnmpTrapEventTags dataSource={dataSource} tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "snmptrap-signal-tags":
        return (
          <div className="userProfile" >
            <SnmpTrapSignalTags dataSource={dataSource} tags={snmpTrapTags.map(t => t.value)} selectedTags={selectedTags} onTagChange={(updated) => setSelectedTags(updated)} />
          </div>
        );
      case "snmptrap-tag-config":
        return (
          <div className="userProfile" >
            <SnmpTrapTagConfig keycloak={keycloak} currentUser={currentUser} showNotification={showNotification} />
          </div>
        );
      case "snmptrap-oids":
        return (
          <div className="userProfile" >
            <SnmpTrapOids keycloak={keycloak} showNotification={showNotification} />
          </div>
        );
      case "user-profile":
        return (
          <div className="userProfile" >
            <UserProfile currentUser={currentUser} onLogout={handleLogout} toggleTheme={toggleTheme} isDarkTheme={isDarkTheme} />
          </div>
        );
      default:
        return null;
    }
  };


  const handleFiltersChange = (newFilters) => {
    console.log("Filtering for:", newFilters);
  };

  const handleSearchAndCloseDropdown = (filters) => {
    console.log('Selected tags:', filters);
  };

  useEffect(() => {
    console.log("Selected tags in App component:", selectedTags);
  }, [selectedTags]);

  /* =========================================================
   * RENDER
   * ========================================================= */

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<Login keycloak={keycloak} toggleTheme={toggleTheme} isDarkTheme={isDarkTheme} onGuestLogin={handleGuestLogin} />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : (
        <div data-theme={isDarkTheme ? "dark" : "light"} className="App">
          {init && (
            <Particles id="tsparticles" particlesLoaded={particlesLoaded} options={options} />
          )}
          <div className="header">
            <Header currentUser={currentUser} dashboardTitle={dashboardTitle} onTogglePopup={togglePopup} selectedDevice={selectedDevice} />
          </div>
          {activePopup && (
            <div ref={popupRef} className="top-popup-container" >
              {renderPopup()}
            </div>
          )}
          <div className="main-container">
            <div className="sidebar-container">
              <Sidebar />
            </div>
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: "", type: "" })}
            />
            <div className="content">
              <Routes>
                <Route path="/incidents" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated} >
                    <Incidents currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} />
                  </ProtectedRoute>} />
                <Route path="/devices" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated} >
                    <Devices currentUser={currentUser} selectedDevice={selectedDevice} setSelectedDevice={setSelectedDevice} setDashboardTitle={setDashboardTitle} showNotification={showNotification} keycloak={keycloak} devicesRefreshKey={devicesRefreshKey} />
                  </ProtectedRoute>} />
                <Route
                  path="/signals/syslogs/table"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SyslogSignalTable
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSyslogSignalTableTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/signals/syslogs/statistics"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SyslogSignalStatistics
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSyslogSignalStatisticTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/signals/snmp-traps/table"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SnmpTrapSignalTable
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSnmpTrapSignalTableTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/signals/snmp-traps/statistics"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SnmpTrapSignalStatistics
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSnmpTrapSignalStatisticTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/signals/telemetry/table"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <TelemetrySignalTable
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/signals/telemetry/statistics"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <TelemetrySignalStatistics
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/events/syslogs/table"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SyslogEventsTable
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSyslogEventsTableTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/events/syslogs/statistics"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SyslogEventsStatistics
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSyslogEventsStatisticsTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/events/snmp-traps/table"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SnmpTrapEventTable
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSnmpTrapEventsTableTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/events/snmp-traps/statistics"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <SnmpTrapEventStatistics
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                        selectedTags={selSnmpTrapEventsStatisticsTags}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/traffic/table"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <TrafficTable
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/traffic/statistics"
                  element={
                    <ProtectedRoute isAuthenticated={isAuthenticated}>
                      <TrafficStatistics
                        currentUser={currentUser}
                        setDashboardTitle={setDashboardTitle}
                        keycloak={keycloak}
                        showNotification={showNotification}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route path="/performance" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated} >
                    <Performance currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification} selectedDevice={selectedDevice} />
                  </ProtectedRoute>
                } />
                <Route path="/topology" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated} >
                    <Topology currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification} />
                  </ProtectedRoute>
                } />
              </Routes>
            </div>
          </div>
        </div>
      )}

    </BrowserRouter>
  );
};

export default App;