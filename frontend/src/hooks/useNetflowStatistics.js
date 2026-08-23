import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useNetflowStatistics() {
    const [statistics, setStatistics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadStatistics = useCallback(async ({
        keycloak,
        metric,
        field,
        startTime = null,
        endTime = null
    }) => {
        if (!keycloak?.authenticated) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            let url = `/traffic/statistics/${metric}/${field}`;

            const query = new URLSearchParams();

            if (startTime) {
                query.append(
                    "start_time",
                    new Date(startTime).toISOString()
                );
            }

            if (endTime) {
                query.append(
                    "end_time",
                    new Date(endTime).toISOString()
                );
            }

            if (query.toString()) {
                url += `?${query.toString()}`;
            }

            const data = await kcFetch(keycloak, url);

            const results = (data?.statistics || []).map(item => ({
                name: item.value ?? "N/A",
                count: item.count ?? 0,
                total: item.value_sum ?? 0
            }));

            setStatistics(results);

            return results;

        } catch (err) {
            console.error(
                "Error fetching NetFlow statistics:",
                err
            );

            setError("Error fetching NetFlow statistics");
            setStatistics([]);

            throw err;

        } finally {
            setLoading(false);
        }
    }, []);

    return {
        statistics,
        loading,
        error,
        loadStatistics
    };
}