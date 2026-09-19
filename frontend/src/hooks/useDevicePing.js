import { useState, useEffect, useCallback, useRef } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useDevicePing(
    keycloak,
    devices = [],
    autoLoad = true,
    interval = 0 // Default set to 0 so it runs ONLY ONCE on start
) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Keep devices array fresh inside callbacks without re-triggering effects
    const devicesRef = useRef(devices);
    useEffect(() => {
        devicesRef.current = devices;
    }, [devices]);

    const fetchPing = useCallback(async () => {
        if (!keycloak?.authenticated) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await kcFetch(keycloak, "/devices/status/ping");
            const pingDevices = Array.isArray(response?.devices)
                ? response.devices
                : [];

            setData(pingDevices);
        } catch (err) {
            console.error("Failed to fetch device ping status:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [keycloak]);

    // Fetch on initial mount / authentication
    useEffect(() => {
        if (!autoLoad || !keycloak?.authenticated) {
            return;
        }

        fetchPing();

        // Optional polling: runs ONLY if interval > 0 is passed explicitly
        if (interval > 0) {
            const timer = setInterval(fetchPing, interval);
            return () => clearInterval(timer);
        }
    }, [autoLoad, interval, keycloak?.authenticated, fetchPing]);

    return {
        data,
        loading,
        error,
        reload: fetchPing,
    };
}

export default useDevicePing;