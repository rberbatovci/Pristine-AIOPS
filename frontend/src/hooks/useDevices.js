import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useDevices(keycloak, autoLoad = true) {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const token = keycloak?.token;
    const isAuthenticated = keycloak?.authenticated;

    const fetchDevices = useCallback(async () => {
        if (!isAuthenticated) return;

        setLoading(true);
        setError(null);

        try {
            const response = await kcFetch(keycloak, `/devices/`);
            const dataArray = Array.isArray(response) ? response : [];
            const mapped = dataArray.map((device) => ({
                ...device,
                id: device.id,
                hostname: device.hostname,
                ip_address: device.ip_address,
                label: device.hostname,
                status: "unknown",
                features: device.features || {},
                origin: "onboarded",
            }));

            setDevices(mapped);
        } catch (err) {
            console.error("Error fetching device data:", err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [token, isAuthenticated]); // Depend on stable primitive properties rather than the full keycloak object instance

    useEffect(() => {
        if (autoLoad && isAuthenticated) {
            fetchDevices();
        }
    }, [autoLoad, isAuthenticated, fetchDevices]);

    return {
        devices,
        loading,
        error,
        reload: fetchDevices,
    };
}

export default useDevices;