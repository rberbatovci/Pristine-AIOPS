import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useUserPreferences(keycloak, autoLoad = true) {
  const [preferences, setPreferences] = useState({
    theme: "light",
    timezone: "UTC",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPreferences = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(keycloak, `/users/me/preferences`);

      setPreferences({
        theme: response?.theme ?? "light",
        timezone: response?.timezone ?? "UTC",
      });
    } catch (err) {
      console.error("Error fetching user preferences:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const updateTheme = useCallback(
    async (theme) => {
      if (!keycloak?.authenticated) return;

      try {
        const response = await kcFetch(
          keycloak,
          `/users/me/preferences/theme`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ theme }),
          }
        );

        setPreferences((prev) => ({
          ...prev,
          theme: response?.theme ?? theme,
        }));
      } catch (err) {
        console.error("Error updating theme:", err);
        setError(err);
      }
    },
    [keycloak]
  );

  const updateTimezone = useCallback(
    async (timezone) => {
      if (!keycloak?.authenticated) return;

      try {
        const response = await kcFetch(
          keycloak,
          `/users/me/preferences/timezone`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ timezone }),
          }
        );

        setPreferences((prev) => ({
          ...prev,
          timezone: response?.timezone ?? timezone,
        }));
      } catch (err) {
        console.error("Error updating timezone:", err);
        setError(err);
      }
    },
    [keycloak]
  );

  useEffect(() => {
    if (autoLoad && keycloak?.authenticated) {
      fetchPreferences();
    }
  }, [fetchPreferences, autoLoad, keycloak?.authenticated]);
 
  return {
    preferences,
    loading,
    error,
    reload: fetchPreferences,
    updateTheme,
    updateTimezone,
  };
}