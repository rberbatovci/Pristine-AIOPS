import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useSyslogRegExDetails({ keycloak }) {
  const [selectedRegex, setSelectedRegex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(
    async (method, path = "", body = null) => {
      if (!keycloak?.authenticated) {
        throw new Error("Keycloak not authenticated");
      }

      return kcFetch(keycloak, `/syslogs/regex/${path}`.replace(/\/+/g, "/"), {
        method,
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    },
    [keycloak]
  );

  const get = useCallback(async (name) => {
    setLoading(true);
    setError(null);

    try {
      const data = await request("GET", `/${name}`);
      setSelectedRegex(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [request]);

  const create = useCallback(async (payload) => {
    setLoading(true);
    setError(null);

    try {
      return await request("POST", "/", payload);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [request]);

  const update = useCallback(async (name, payload) => {
    setLoading(true);
    setError(null);

    try {
      const updated = await request("PUT", `/${name}/`, payload);
      setSelectedRegex(updated);
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [request]);

  const remove = useCallback(async (name) => {
    setLoading(true);
    setError(null);

    try {
      await request("DELETE", `/${name}/`);
      setSelectedRegex(null);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [request]);

  return {
    selectedRegex,
    loading,
    error,
    get,
    create,
    update,
    remove,
    setSelectedRegex,
  };
}