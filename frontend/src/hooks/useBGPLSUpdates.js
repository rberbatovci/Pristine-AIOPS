import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

const PAGE_SIZE = 22;

export function useBgpLinkStateData() {
  const [eventsData, setEventsData] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(
    async (
      keycloak,
      page = 1,
      startTime = null,
      endTime = null,
      filters = {}
    ) => {
      // Early exit if Keycloak isn't ready
      if (!keycloak?.authenticated) {
        setError("User is not authenticated");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Build base search params
        const query = new URLSearchParams({
          page: page.toString(),
          page_size: PAGE_SIZE.toString(),
        });

        // Time filters
        if (startTime) {
          query.append("start_time", new Date(startTime).toISOString());
        }
        if (endTime) {
          query.append("end_time", new Date(endTime).toISOString());
        }

        // Array filter mappings
        const arrayFilters = [
          { key: "event_type", values: filters.event_type },
          { key: "nlri_type", values: filters.nlri_type },
          { key: "sourceId", values: filters.sourceId },
          { key: "neighborIp", values: filters.neighborIp },
          { key: "sourceAsn", values: filters.sourceAsn },
        ];

        arrayFilters.forEach(({ key, values }) => {
          if (Array.isArray(values)) {
            values.forEach((val) => query.append(key, val));
          }
        });

        // Boolean filter
        if (filters.is_withdraw !== undefined && filters.is_withdraw !== null) {
          query.append("is_withdraw", filters.is_withdraw.toString());
        }

        // Generic tag object filters
        if (filters.tags && typeof filters.tags === "object") {
          Object.entries(filters.tags).forEach(([key, values]) => {
            if (Array.isArray(values)) {
              const cleanKey = key.trim();
              values.forEach((value) => query.append(cleanKey, value));
            }
          });
        }

        // Send request through kcFetch (kcFetch automatically prepends /api)
        const endpoint = `/topology/updates/events?${query.toString()}`;
        const data = await kcFetch(keycloak, endpoint);

        let results = [];
        let totalCount = 0;

        if (data?.results) {
          results = data.results.map((item) => item._source || item);
          totalCount = data.total || 0;
        } else if (Array.isArray(data)) {
          results = data.map((item) => item._source || item);
          totalCount = results.length;
        } else {
          console.warn("Unexpected response structure:", data);
        }

        setEventsData(results);
        setTotalEvents(totalCount);
        setTotalPages(Math.ceil(totalCount / PAGE_SIZE));
      } catch (err) {
        console.error("Error fetching BGP Link State data:", err);
        setError(err.message || "Failed to fetch BGP Link State data");
        setEventsData([]);
        setTotalEvents(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    eventsData,
    totalPages,
    totalEvents,
    loading,
    error,
    loadData,
  };
}