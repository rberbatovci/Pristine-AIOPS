import './App.css';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { lightThemeOptions, darkThemeOptions } from './components/misc/ParticleOptions';
import Header from './components/Header';
import Incidents from './pages/Incidents';
import Sidebar from './components/Sidebar';
import Statistics from './pages/Statistics';
import Login from './components/Login';
import SignalsDashboard from './pages/SignalsDashboard';
import Netflow from './pages/Netflow';
import TrapSignals from './pages/TrapSignals';
import EventsDatabase from './pages/EventsDatabase';
import ProtectedRoute from './components/misc/ProtectedRoute';
import Syslogs from './pages/Syslogs';
import SNMPTraps from './pages/SNMPTraps';
import Geolocation from './pages/Geolocation';
import Devices from './pages/Devices';

const App = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [selectedHostnames, setSelectedHostnames] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const containerRef = useRef(null);
  const [init, setInit] = useState(false);

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

    initParticlesEngine(async (engine) => {
      console.log("engine:", engine);
      await loadSlim(engine);
      console.log("loadSlim completed");
    }).then(() => setInit(true));
  }, [init]);

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
          <Header currentUser={currentUser} />
          <div className="main-container">
            <div className="sidebar-container">
              <div className="sidebar">
                <Sidebar
                  toggleTheme={toggleTheme}
                  isDarkTheme={isDarkTheme}
                  currentUser={currentUser}
                  onLogout={handleLogout} />
              </div>
              <div className="brand"></div>
            </div>
            <div className="content">
              <Routes>
                <Route path="/incidents" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Incidents currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/signalsdashboard" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <SignalsDashboard currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/trapsignals" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <TrapSignals currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/statistics" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Statistics currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/devices" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Devices currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/syslogs" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Syslogs currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/snmptraps" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <SNMPTraps currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/netflow" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Netflow currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/geolocation" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Geolocation currentUser={currentUser} />
                  </ProtectedRoute>
                } />
                <Route path="/events" element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <EventsDatabase currentUser={currentUser} />
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
