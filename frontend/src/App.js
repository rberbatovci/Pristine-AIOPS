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
import Statistics from './pages/Statistics';
import Login from './components/misc/Login';
import Signals from './pages/Signals';
import Events from './pages/Events';
import ProtectedRoute from './components/misc/ProtectedRoute';
import Geolocation from './pages/Geolocation';
import Devices from './pages/Devices';

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
    if (status) {
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("isAuthenticated", JSON.stringify(true));
    } else {
      localStorage.removeItem("currentUser");
      localStorage.setItem("isAuthenticated", JSON.stringify(false));
    }
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
            <div className="content">
              <Routes>
                <Route path="/incidents" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Incidents currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/signalsdashboard" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Signals currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/statistics" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Statistics currentUser={currentUser} setDashboardTitle={setDashboardTitle} />
                  </ProtectedRoute>
                } />
                <Route path="/devices" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Devices currentUser={currentUser} setDashboardTitle={setDashboardTitle} />
                  </ProtectedRoute>
                } />
                <Route path="/geolocation" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated} >
                    <Geolocation currentUser={currentUser} setDashboardTitle={setDashboardTitle} />
                  </ProtectedRoute>
                } />
                <Route path="/events" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Events currentUser={currentUser} setDashboardTitle={setDashboardTitle}
                    />
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
