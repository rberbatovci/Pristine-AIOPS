import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { lightThemeOptions, darkThemeOptions } from "./components/misc/ParticleOptions";
import './App.css';

import Login from "./components/misc/Login";
import Header from "./components/misc/Header";
import Sidebar from "./components/misc/Sidebar";
import UserProfile from "./components/misc/UserProfile";
import Notification from "./components/misc/Notification";
import ProtectedRoute from "./components/misc/ProtectedRoute";
import Incidents from "./pages/Incidents";
import Signals from "./pages/Signals";
import Devices from "./pages/Devices";
import Faults from "./pages/Faults";
import Traffic from "./pages/Traffic";
import Performance from "./pages/Performance";
import Topology from "./pages/Topology";

const App = ({ keycloak, keycloakAuthenticated }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    keycloak.authenticated || false
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const containerRef = useRef(null);
  const userProfileRef = useRef(null);
  const [init, setInit] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('');

  // Keycloak authentication setup
  useEffect(() => {
    if (keycloak.authenticated && keycloak.tokenParsed) {
      const data = keycloak.tokenParsed;
      setCurrentUser({
        username: data.preferred_username,
        email: data.email,
        name: data.name || data.preferred_username,
        roles: data.realm_access?.roles || [],
      });
      setIsAuthenticated(true);
    }
  }, [keycloak]);

  // Theme
  const toggleTheme = () => {
    setIsDarkTheme(prev => {
      const newTheme = !prev;
      localStorage.setItem("theme", JSON.stringify(newTheme));
      return newTheme;
    });
  };

  // Guest login
  const handleGuestLogin = () => {
    setIsAuthenticated(true);
    setCurrentUser({ username: "guest", name: "Guest User", roles: [] });
  };

  // Logout
  const handleLogout = () => {
    if (keycloak.authenticated) keycloak.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    localStorage.setItem("isAuthenticated", "false");
  };

  // Particles
  useEffect(() => {
    if (!init) {
      initParticlesEngine(async engine => {
        await loadFull(engine);
        setInit(true);
      });
    }
  }, [init]);

  // Click outside user profile
  useEffect(() => {
    const handleClickOutside = e => {
      if (userProfileRef.current && !userProfileRef.current.contains(e.target)) {
        setShowUserProfile(false);
      }
    };
    if (showUserProfile) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserProfile]);

  const options = useMemo(() => (isDarkTheme ? darkThemeOptions : lightThemeOptions), [isDarkTheme]);
  const particlesLoaded = useCallback(container => { containerRef.current = container; }, []);

  const toggleUserProfile = () => setShowUserProfile(prev => !prev);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
  };

  return (
    <BrowserRouter>
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={ <Login keycloak={keycloak} toggleTheme={toggleTheme} isDarkTheme={isDarkTheme} onGuestLogin={handleGuestLogin} /> }/>
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      ) : (
        <div data-theme={isDarkTheme ? 'dark' : 'light'} className="App">
          {init && (
            <Particles id="tsparticles" particlesLoaded={particlesLoaded} options={options} />
          )}
          <div className="header">
            <Header currentUser={currentUser} dashboardTitle={dashboardTitle} onToggleUserProfile={toggleUserProfile} />
          </div >
          {showUserProfile && (
            <div ref={userProfileRef} className="userProfile">
              <UserProfile currentUser={currentUser} onLogout={handleLogout} toggleTheme={toggleTheme} isDarkTheme={isDarkTheme}/>
            </div>
          )}
          <div className="main-container">
            <div className="sidebar-container">
              <Sidebar />
            </div>
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: "", type: "" })}/>
            <div className="content">
              <Routes>
                <Route path="/incidents" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Incidents currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak}/></ProtectedRoute>} />
                <Route path="/devices" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Devices currentUser={currentUser} setDashboardTitle={setDashboardTitle} showNotification={showNotification} keycloak={keycloak}/></ProtectedRoute>} />
                <Route path="/signals" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Signals currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification}/></ProtectedRoute>} />
                <Route path="/faults" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Faults currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification}/></ProtectedRoute>} />
                <Route path="/traffic" element={ <ProtectedRoute isAuthenticated={isAuthenticated}><Traffic currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification}/></ProtectedRoute> } />
                <Route path="/performance" element={ <ProtectedRoute isAuthenticated={isAuthenticated}> <Performance currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification}/></ProtectedRoute>} />
                <Route path="/topology" element={<ProtectedRoute isAuthenticated={isAuthenticated}><Topology currentUser={currentUser} setDashboardTitle={setDashboardTitle} keycloak={keycloak} showNotification={showNotification}/></ProtectedRoute>} />
              </Routes>
            </div>
          </div>
        </div>
      )}
    </BrowserRouter>
  );
};

export default App;
