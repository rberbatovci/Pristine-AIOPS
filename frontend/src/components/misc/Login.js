import React from "react";
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { lightThemeOptions, darkThemeOptions } from "../misc/ParticleOptions";
import { FaSun, FaMoon, FaUserLock, FaUserAlt } from "react-icons/fa";

function Login({ keycloak, isDarkTheme, onGuestLogin }) {
  const handleKeycloakLogin = async () => {
    await keycloak.login();
    window.location.reload();
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "var(--backgroundColor1)",
      }}
    >
      {/* Background Particles */}
      <Particles
        id="tsparticles"
        init={async (engine) => await loadSlim(engine)}
        options={isDarkTheme ? darkThemeOptions : lightThemeOptions}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      />

      {/* Login Card */}
      <div
        style={{
          position: "relative",
          width: "500px",
          padding: "45px 40px 50px 40px",
          borderRadius: "15px",
          color: "var(--tagListCol)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          backdropFilter: "blur(12px)",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          zIndex: 2,
          textAlign: "center",
        }}
      >
        {/* Theme Toggle */}
        <button
           
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.1rem",
            color: "var(--tagListColHov)",
          }}
          title="Toggle Theme"
        >
          {isDarkTheme ? <FaSun /> : <FaMoon />}
        </button>

        {/* Branding */}
        <div style={{ marginBottom: "25px" }}>
          <p style={{ marginBottom: "-5px", fontSize: "1rem" }}>Welcome to</p>
          <h1
            style={{
              color: "var(--tagListColHov)",
              fontFamily: "'Russo One', sans-serif",
              letterSpacing: "2px",
              fontSize: "3rem",
              marginBottom: "10px",
            }}
          >
            Pristine-AIOPS
          </h1>

          {/* Professional Tagline / Description */}
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--tagListCol)",
              lineHeight: "1.5",
              margin: "0 20px 30px 20px",
              fontStyle: "italic",
              color: "var(--tagListCol)",
            }}
          >
            Empowering network intelligence with real-time anomaly detection,
            unified monitoring, and automated insights — built for modern
            infrastructure.
          </p>
        </div>

        {/* Dual Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            gap: "15px",
          }}
        >
          {/* Keycloak Login */}
          <button
            onClick={handleKeycloakLogin}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "8px",
              background: "var(--searchButtonBackHover)",
              color: "#fff",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";
              e.target.style.fontSize = "1.2rem";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "none";
              e.target.style.fontSize = "1rem";
            }}
          >
            <FaUserLock />
            Login
          </button>

          {/* Guest Login */}
          <button
            onClick={onGuestLogin}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "8px",
              backgroundColor: "var(--backgroundColor2)",
              color: "var(--tagListColHov)",
              border: "1px solid var(--tagListColHov)",
              fontWeight: "bold",
              fontSize: "1rem",
              cursor: "pointer",
              transition:
                "transform 0.2s ease, background 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "var(--tagListColHov)";
              e.target.style.color = "#fff";
              e.target.style.transform = "scale(1.05)";
              e.target.style.fontSize = "1.2rem";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "transparent";
              e.target.style.color = "var(--tagListColHov)";
              e.target.style.transform = "scale(1)";
              e.target.style.fontSize = "1rem";
            }}
          >
            <FaUserAlt />
            Guest
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
