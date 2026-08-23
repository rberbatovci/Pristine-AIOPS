import { useState, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

const useRedisTelemetryData = ({ keycloak, pattern, enabled = true }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isSubscribed = true;

    if (!enabled || !keycloak?.authenticated) {
      setData([]);
      setLoading(false);
      return;
    }

    const fetchRedisData = async () => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({ pattern }).toString();
        const response = await kcFetch(
          keycloak,
          `/telemetry/redis/?${query}`
        );

        if (isSubscribed) {
          // Normalize payload array from backend Redis response
          const result = Array.isArray(response)
            ? response
            : response?.data || [];
          setData(result);
        }
      } catch (err) {
        if (isSubscribed) {
          console.error("Error fetching Redis telemetry:", err);
          setError(err?.message || "Failed to fetch Redis telemetry data");
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchRedisData();

    return () => {
      isSubscribed = false;
    };
  }, [keycloak, pattern, enabled]);

  return { data, loading, error };
};

export default useRedisTelemetryData;