import React, { useState } from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { lightThemeOptions, darkThemeOptions } from '../misc/ParticleOptions';
import { FaSun, FaMoon } from "react-icons/fa";

function Login({ onAuthentication, toggleTheme, isDarkTheme }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const expirationDate = new Date("2025-11-03T23:59:59"); // October 1st, 2025
  const expirationDateStr = expirationDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const isTrialExpired = () => {
    const now = new Date();
    return now > expirationDate;
  };

  const handleContinue = () => {
    if (isTrialExpired()) {
      setError("This trial has expired. Please contact support.");
      return;
    }

    onAuthentication(true, name);
  };

  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <Particles
        id="tsparticles"
        init={async (engine) => await loadSlim(engine)}
        options={isDarkTheme ? darkThemeOptions : lightThemeOptions}
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}
      />
      <div style={{
        backgroundColor: 'var(--backgroundColor2)',
        width: '400px',
        padding: '20px',
        borderRadius: '10px',
        color: 'var(--tagListCol)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        position: 'relative'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '1px',
          background: 'linear-gradient(to right, transparent, var(--searchButtonBack), transparent)'
        }} />
        <p style={{ marginBottom: '10px' }}>Welcome to</p>
        <h1 style={{ color: 'var(--tagListColHov)', fontFamily: "'Russo One', sans-serif"}}>Pristine-AIOPS</h1>
        <div style={{ background: 'var(--backgroundColor3)', padding: '10px', borderRadius: '10px', marginTop: '10px', marginBottom: '10px'}}>
        <p style={{ marginTop: '10px', fontSize: '0.9rem', textAlign: 'center' }}>
          Thank you for trying our tool! 
          Pristine-AIOPS v1.1 is available until <strong>{expirationDateStr}</strong>.
        </p>
        <p>It's a pleasure meeting you. Please tell us your name:</p>
        </div>
        <input
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => {
            setError(""); // clear error when user types
            setName(e.target.value);
          }}
          className="inputText"
          style={{ width: '100%', marginTop: '15px' }}
        />
        {error && (
          <p style={{ color: 'red', marginTop: '10px', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}
        <button
          onClick={handleContinue}
          disabled={!name.trim()}
          style={{ marginTop: '15px' }}
        >
          Enter App
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
            color: 'var(--tagListColHov)'
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
