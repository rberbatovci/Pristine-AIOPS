import { useCallback, useEffect, useState } from "react";
import kcFetch from "../components/misc/kcFetch";

// Stable reference for empty default parameters
const EMPTY_PARAMS = {};

const useTelemetryData = ({
  keycloak,
  path,
  device,
  startTime = null,
  endTime = null,
  limit = 100,
  params = EMPTY_PARAMS,
  enabled = true,
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Serialize object params to primitive strings to prevent reference loops
  const serializedParams = JSON.stringify(params);

  const loadData = useCallback(async () => {
    if (!keycloak?.authenticated || !enabled || !path) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (device) queryParams.append("device", device);
      if (startTime) queryParams.append("startTime", startTime);
      if (endTime) queryParams.append("endTime", endTime);
      if (limit) queryParams.append("limit", limit);

      const parsedParams = JSON.parse(serializedParams);
      Object.entries(parsedParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, value);
        }
      });

      const queryString = queryParams.toString();
      const url = queryString ? `${path}?${queryString}` : path;

      const response = await kcFetch(keycloak, url);
      setData(response?.results ?? []);
    } catch (err) {
      console.error(`Failed to fetch telemetry data from ${path}:`, err);
      setError("Failed to load telemetry data.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
    keycloak,
    path,
    device,
    startTime,
    endTime,
    limit,
    serializedParams, // Using serialized string instead of object reference
    enabled,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    reload: loadData,
  };
};

export default useTelemetryData;