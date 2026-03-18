import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import keycloak from "./components/misc/Keycloak";

const root = ReactDOM.createRoot(document.getElementById("root"));

async function initApp() {
  try {
    const authenticated = await keycloak.init({
      onLoad: "login-required",
      pkceMethod: "S256",
      silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
      checkLoginIframe: false,
    });

    // If not logged in silently → force real login
    if (!authenticated) {
      keycloak.login();
      return;
    }

    // Tokens now include preferred_username
    localStorage.setItem("accessToken", keycloak.token);
    localStorage.setItem("refreshToken", keycloak.refreshToken);

    setInterval(() => {
      keycloak
        .updateToken(30)
        .catch(() => console.warn("Token refresh failed"));
    }, 10000);

    root.render(<App keycloak={keycloak} />);
  } catch (err) {
    console.error("Keycloak init error:", err);
  }
}

initApp();