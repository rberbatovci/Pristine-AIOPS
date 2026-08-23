import { useCallback } from 'react';
import kcFetch from '../components/misc/kcFetch'; 

export function useFilterOptions(keycloak) {

    const getOptions = useCallback(async ({
        resource,
        field,
        filters = {},
        startTime,
        endTime
    }) => {

        const params = new URLSearchParams();

        Object.entries(filters).forEach(([key, values]) => {
            if (!Array.isArray(values)) return;

            values.forEach(value => {
                params.append(key, value);
            });
        });

        if (startTime) {
            params.append("start_time", startTime);
        }

        if (endTime) {
            params.append("end_time", endTime);
        }

        const query = params.toString();

        const url = query
            ? `/${resource}/options/${encodeURIComponent(field)}?${query}`
            : `/${resource}/options/${encodeURIComponent(field)}`;

        return kcFetch(keycloak, url, {
            method: "GET"
        });

    }, [keycloak]);

    return { getOptions };

}