import React, { useState } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { lightThemeOptions, darkThemeOptions } from './misc/ParticleOptions';
import { useNavigate } from 'react-router-dom';
import apiClient from './misc/AxiosConfig';

function Login({ onAuthentication }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const navigate = useNavigate();
  const [buttonText, setButtonText] = useState('Login')
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    email: "",
    rePassword: "",
    isStaff: false,  // Update field for staff role
  });
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'light'
  );
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  const toggleForm = () => {
    setIsRegistering(!isRegistering);
    setFormData({ username: "", password: "", rePassword: "", isStaff: false });
    setButtonText(!isRegistering ? "Register" : "Login");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setButtonText('Loading...');

    if (formData.password !== formData.rePassword) {
        alert("Passwords do not match!");
        setButtonText('Register');
        setLoading(false);
        return;
    }

    try {
        const response = await apiClient.post("/users/", {
            username: formData.username,
            email: formData.email,
            password: formData.password,
            is_staff: formData.isStaff  // Send staff status to backend
        });

        if (response.status === 200) {
            setButtonText('Registration successful!');
            setTimeout(() => {
                setIsRegistering(false);
                setButtonText('Login');
            }, 2000);
        } else {
            setButtonText('Register');
            alert(response.data.detail || "Registration failed");
        }
    } catch (error) {
        setButtonText('Register');
        alert(error.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
        setLoading(false);
    }
};

const handleLogin = async (e) => {
  e.preventDefault();
  setButtonText('Loading...');
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
          setButtonText('Login successful...');
          navigate("/signals");
      } else {
          setButtonText('Login');
          alert(`Error: ${response.data.detail || "Something went wrong"}`);
      }
  } catch (error) {
      console.error("Error:", error);
      setButtonText('Login');
      alert("Invalid credentials or server error. Please try again.");
  } finally {
      setLoading(false);
  }
};

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('storedTheme', newTheme);
  };

  return (
    <div style={styles.container}>
      <Particles
        id="tsparticles"
        init={async (engine) => await loadSlim(engine)}
        options={theme === 'light' ? lightThemeOptions : darkThemeOptions}
        style={styles.particles}
      />
      <div style={styles.content}>
        <h2>{isRegistering ? "Register" : "Login"}</h2>
        <form onSubmit={isRegistering ? handleRegister : handleLogin} style={styles.form}>
          <input
            type="text"
            name="username"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
            required
            style={styles.input}
          />
          {isRegistering && (
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
              style={styles.input}
            />
          )}
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
            style={styles.input}
          />
          {isRegistering && (
            <input
              type="password"
              name="rePassword"
              placeholder="Repeat Password"
              value={formData.rePassword}
              onChange={handleChange}
              required
              style={styles.input}
            />
          )}
          {isRegistering && (
            <label>
              <input
                type="checkbox"
                name="isStaff"
                checked={formData.isStaff}
                onChange={(e) => setFormData((prev) => ({ ...prev, isStaff: e.target.checked }))}
                style={styles.input}
              />
              Staff
            </label>
          )}

          <button type="submit" style={styles.button} disabled={loading}>
            {buttonText}
          </button>
        </form>
        <button onClick={toggleForm} style={styles.toggleButton}>
          {isRegistering ? "Already have an account? Login" : "New user? Register"}
        </button>
        <button onClick={toggleTheme} style={styles.themeButton}>
          {theme === 'light' ? <i className="fas fa-moon"></i> : <i className="fas fa-sun"></i>}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "relative",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    backgroundColor: "var(--dropdownBackground)",
    alignItems: "center",
  },
  particles: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 1,
  },
  content: {
    position: "relative",
    zIndex: 2,
    background: "#ffffffcc",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    textAlign: "center",
    width: '400px',
    background: "#ffffffcc",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  input: {
    margin: "10px 0",
    padding: "10px",
    fontSize: "16px",
    borderRadius: "4px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "10px",
    fontSize: "16px",
    color: "#fff",
    background: "#007bff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  toggleButton: {
    marginTop: "10px",
    fontSize: "14px",
    color: "#007bff",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
};

export default Login;