import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useFaultData() {
  const [eventsData, setEventsData] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const PAGE_SIZE = 22;

  const loadData = useCallback(async (
    keycloak,
    dataSource,
    page,
    startTime = null,
    endTime = null,
    filters = {}
  ) => {
    if (!keycloak?.authenticated) return;

    setEventsData(null);
    setLoading(true);
    setError(null);

    try {
      let url = "";

      if (dataSource === "syslogs") {
        url = `/syslogs/?page=${page}&page_size=${PAGE_SIZE}`;
      } else if (dataSource === "snmptraps") {
        url = `/traps/?page=${page}&page_size=${PAGE_SIZE}`;
      } else if (dataSource === "netflow") {
        url = `/netflow/?page=${page}&page_size=${PAGE_SIZE}`;
      } else {
        throw new Error(`Unknown dataSource: ${dataSource}`);
      }

      if (startTime) {
        const start = new Date(startTime).toISOString();
        url += `&start_time=${encodeURIComponent(start)}`;
      }

      if (endTime) {
        const end = new Date(endTime).toISOString();
        url += `&end_time=${encodeURIComponent(end)}`;
      }

      const query = new URLSearchParams();

      if (filters.device?.length) {
        filters.device.forEach(device =>
          query.append("device", device)
        );
      }

      if (filters.mnemonic?.length) {
        filters.mnemonic.forEach(m =>
          query.append("mnemonic", m)
        );
      }

      if (filters.snmpTrapOid?.length) {
        filters.snmpTrapOid.forEach(oid =>
          query.append("snmpTrapOid", oid)
        );
      }

      if (filters.tags && typeof filters.tags === "object") {
        for (const [key, values] of Object.entries(filters.tags)) {
          if (!Array.isArray(values) || values.length === 0) continue;

          const cleanKey = key.trim();

          values.forEach(value => {
            query.append(cleanKey, value);
          });
        }
      }

      if (query.toString()) {
        url += `&${query.toString()}`;
      }

      const data = await kcFetch(keycloak, url);

      let results = [];

      if (data?.results) {
        results = data.results.map(item => item._source || item);
        setTotalEvents(data.total || 0);
      } else if (Array.isArray(data)) {
        results = data.map(item => item._source || item);
        setTotalEvents(data.length);
      } else {
        console.warn("Unexpected response data structure:", data);
      }
      setTotalPages(Math.ceil((data.total || results.length) / PAGE_SIZE));
      setEventsData(results);
      console.log("Fetched data:", results);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Error fetching data");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    eventsData,
    totalPages,
    totalEvents,
    loading,
    error,
    loadData
  };
}