import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useDevices(keycloak, autoLoad = true) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDevices = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(keycloak, `/devices/`);

      const mapped = response.map(device => ({
        id: device.id,
        hostname: device.hostname,
        ip_address: device.ip_address,
        label: device.hostname
      }));

      setDevices(mapped);
    } catch (err) {
      console.error("Error fetching device data:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad && keycloak?.authenticated) {
      fetchDevices();
    }
  }, [fetchDevices, autoLoad, keycloak?.authenticated]);

  return {
    devices,
    loading,
    error,
    reload: fetchDevices
  };
}
