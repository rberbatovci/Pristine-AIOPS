import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useSyslogSeverity(keycloak, autoLoad = true) {
  const [severity, setSeverity] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSeverity = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(
        keycloak,
        "/syslogs/signals/rules/severity/"
      );

      // response is a single object: { number, description }
      setSeverity({
        number: response.number,
        description: response.description
      });
    } catch (err) {
      console.error("Error fetching syslog severity:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad) {
      fetchSeverity();
    }
  }, [fetchSeverity, autoLoad]);

  return {
    severity,          // { number, description } | null
    loading,
    error,
    reload: fetchSeverity
  };
}
