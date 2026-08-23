import { useState, useEffect, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useDeviceStatus(
    keycloak,
    device,
    metric,
    autoLoad = true
) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchStatus = useCallback(async () => {
        if (!keycloak?.authenticated || !device?.hostname)
            return;
        setLoading(true);
        setError(null);
        try {
            const response = await kcFetch(
                keycloak,
                `/devices/status/${device.hostname}/${metric}/`
            );
            setData(response);
        } catch (err) {
            console.error(err);
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [keycloak, device?.hostname, metric]);

    useEffect(() => {
        if (autoLoad)
            fetchStatus();
    }, [fetchStatus, autoLoad]);

    return {
        data,
        loading,
        error,
        reload: fetchStatus
    };
}

export default useDeviceStatus;