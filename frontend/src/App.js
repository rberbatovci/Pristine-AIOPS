import './App.css';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { loadSlim } from "@tsparticles/slim";
import { lightThemeOptions, darkThemeOptions } from './components/misc/ParticleOptions';
import Header from './components/misc/Header';
import UserProfile from './components/misc/UserProfile';
import Incidents from './pages/Incidents';
import Sidebar from './components/misc/Sidebar';
import Login from './components/misc/Login';
import Signals from './pages/Signals';
import Faults from './pages/Faults';
import Traffic from './pages/Traffic';
import Performance from './pages/Performance';
import ProtectedRoute from './components/misc/ProtectedRoute';
import Topology from './pages/Topology';
import Devices from './pages/Devices';
import Notification from "./components/misc/Notification";

const App = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedHostnames, setSelectedHostnames] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const containerRef = useRef(null);
  const userProfileRef = useRef(null);
  const [init, setInit] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [notification, setNotification] = useState({ message: "ssssssss", type: "ssssssss" });

  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    const storedAuthStatus = localStorage.getItem("isAuthenticated");
    const storedTheme = localStorage.getItem("theme");


    if (storedUser && storedAuthStatus) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        setIsAuthenticated(JSON.parse(storedAuthStatus));
      } catch (error) {
        console.error("Failed to parse currentUser or isAuthenticated from localStorage:", error);
        localStorage.removeItem("currentUser");
        localStorage.removeItem("isAuthenticated");
      }
    }

    if (storedTheme) {
      setIsDarkTheme(JSON.parse(storedTheme));
    }

    if (init) return;

    if (!init) {
      initParticlesEngine(async (engine) => {
        await loadFull(engine);
        setInit(true);
      });
    }
  }, [init]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userProfileRef.current && !userProfileRef.current.contains(event.target)) {
        setShowUserProfile(false);
      }
    };

    if (showUserProfile) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserProfile]);

  const toggleTheme = () => {
    setIsDarkTheme((prevTheme) => {
      const newTheme = !prevTheme;
      localStorage.setItem("theme", JSON.stringify(newTheme));
      return newTheme;
    });
  };

  const handleAuthentication = (status, user) => {
    setIsAuthenticated(status);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    localStorage.setItem("isAuthenticated", JSON.stringify(false));
  };

  const handleHostnamesSelect = (hostnames) => {
    setSelectedHostnames(hostnames);
  };

  const particlesLoaded = useCallback((container) => {
    containerRef.current = container;
    window.particlesContainer = container;
  }, []);

  const options = useMemo(() => (isDarkTheme ? darkThemeOptions : lightThemeOptions), [isDarkTheme]);

  const toggleUserProfile = () => setShowUserProfile(prev => !prev);

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
  };

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <div data-theme={isDarkTheme ? 'dark' : 'light'} className="App">
          {init && (
            <Particles
              id="tsparticles"
              particlesLoaded={particlesLoaded}
              options={options}
            />
          )}
          <div className="header">
            <Header currentUser={currentUser} dashboardTitle={dashboardTitle} onToggleUserProfile={toggleUserProfile} />
          </div >
          {showUserProfile && (
            <div ref={userProfileRef} className="userProfile">
              <UserProfile
                currentUser={currentUser}
                onLogout={handleLogout}
                toggleTheme={toggleTheme}
                isDarkTheme={isDarkTheme}
              />
            </div>
          )}
          <div className="main-container">
            <div className="sidebar-container">
              <Sidebar />
            </div>
            <Notification
              message={notification.message}
              type={notification.type}
              onClose={() => setNotification({ message: "", type: "" })}
            />
            <div className="content">
              <Routes>
                <Route path="/incidents" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Incidents currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/devices" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Devices currentUser={currentUser} setDashboardTitle={setDashboardTitle} showNotification={showNotification}/>
                  </ProtectedRoute>
                } />
                <Route path="/signals" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Signals currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/faults" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Faults currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/traffic" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Traffic currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/performance" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Performance currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/topology" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Topology currentUser={currentUser} setDashboardTitle={setDashboardTitle} />
                  </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/login" />} />
              </Routes>
            </div>
          </div>
        </div>
      ) : (
        <div data-theme={isDarkTheme ? 'dark' : 'light'} className="login-container">
          <Login
            onAuthentication={handleAuthentication}
            toggleTheme={toggleTheme}
            isDarkTheme={isDarkTheme}
          />
        </div>
      )}
    </BrowserRouter>
  );
};

export default App;
