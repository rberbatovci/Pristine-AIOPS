import React, { useState } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { lightThemeOptions, darkThemeOptions } from './misc/ParticleOptions';
import { useNavigate } from 'react-router-dom';
import apiClient from './misc/AxiosConfig';
import { FaSun, FaMoon } from "react-icons/fa";

function Login({ onAuthentication, toggleTheme, isDarkTheme }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    rePassword: "",
    isStaff: false,  // Update field for staff role
  });

  const toggleForm = () => {
    setIsRegistering(!isRegistering);
    setFormData({ username: "", password: "", rePassword: "", isStaff: false });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (formData.password !== formData.rePassword) {
      alert("Passwords do not match!");
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.post("/users/register/", {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        is_staff: formData.isStaff
      });

      if (response.status === 200) {
        setTimeout(() => {
          setIsRegistering(false);
        }, 2000);
      } else {
        alert(response.data.detail || "Registration failed");
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await apiClient.post("/token", new URLSearchParams({
        username: formData.username,
        password: formData.password,
        grant_type: "password"
      }), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      if (response.data.access_token) {
        const user = {
          username: response.data.username,  // Now comes from backend
          is_staff: response.data.is_staff    // New field
        };
        localStorage.setItem("accessToken", response.data.access_token);
        localStorage.setItem("isAuthenticated", JSON.stringify(true));
        localStorage.setItem("currentUser", JSON.stringify(user));
        onAuthentication(true, user);
        navigate("/signals");
      } else {
        alert(`Error: ${response.data.detail || "Something went wrong"}`);
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Invalid credentials or server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: 'var(--backgroundColor)' }}>}>
      <Particles
        id="tsparticles"
        init={async (engine) => await loadSlim(engine)}
        options={isDarkTheme ? darkThemeOptions : lightThemeOptions}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}
      />
      <div style={{
        backgroundColor: 'var(--backgroundColor2)',
        width: '400px',
        padding: '10px',
        borderRadius: '10px',
        color: 'var(--tagListCol)',
        display: 'block',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        paddingTop: '20px' // make room for top bar
      }}>
        {/* Gradient border bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '1px',
          background: 'linear-gradient(to right, transparent, var(--tagListColHov), transparent)'
        }} />
        <span>Welcome to</span>
        <h2>Pristine-AIOPS</h2>

        <div style={{
          backgroundColor: 'var(--backgroundColor3)',
          width: '340px',
          margin: '10px auto 0', // ✅ center horizontally
          padding: '10px',
          borderRadius: '8px',
          color: 'var(--tagListCol)'
        }}>
          <span>{isRegistering ? "Register" : "Please login to continue..."}</span>
          <div>
            <input
              type="text"
              name="username"
              placeholder="Username"
              value={formData.username}
              onChange={handleChange}
              required
              className="inputText"
              style={{ width: '330px', marginTop: '10px' }}
            />
            {isRegistering && (
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
                className="inputText"
                style={{ width: '330px', marginTop: '10px' }}
              />
            )}
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
              className="inputText"
              style={{ width: '330px', marginTop: '10px' }}
            />
            {isRegistering && (
              <input
                type="password"
                name="rePassword"
                placeholder="Repeat Password"
                value={formData.rePassword}
                onChange={handleChange}
                required
                className="inputText"
                style={{ width: '330px', marginTop: '10px' }}
              />
            )}
            {isRegistering && (
              <label>
                <input
                  type="checkbox"
                  name="isStaff"
                  checked={formData.isStaff}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isStaff: e.target.checked }))}
                />
                Staff
              </label>
            )}
            {isRegistering ? (
              <button onClick={handleRegister} disabled={loading}>
                Register
              </button>
            ) : (
              <button onClick={handleLogin} disabled={loading}>
                Login
              </button>
            )}
          </div>
        </div>
        <button onClick={toggleForm} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tagListCol)', cursor: 'pointer', marginTop: '10px' }}>
          {isRegistering ? "Already have an account? Login" : "New user? Register"}
        </button>
        <button
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
            color: 'var(--tagListColHov)' // or use a fixed color
          }}
          title="Toggle Theme"
        >
          {isDarkTheme ? <FaSun /> : <FaMoon />}
        </button>
      </div>
    </div>
  );
}

export default Login;