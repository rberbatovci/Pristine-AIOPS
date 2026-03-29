import { useState, useEffect, useCallback } from 'react';
import kcFetch from '../components/misc/kcFetch'; // your fetch utility

export function useSnmpTrapOids(keycloak) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);

  // fetch the full list
  const loadList = async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    try {
      const data = await kcFetch(keycloak, '/traps/trapOids/');
      setList(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch regex list');
    } finally {
      setLoading(false);
    }
  };

  const get = useCallback(async (name) => {
    if (!keycloak?.authenticated || !name) {
      console.warn("Skipping GET: not authenticated or no name", { keycloak, name });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await kcFetch(
        keycloak,
        `/traps/trapOids/${encodeURIComponent(name)}/`
      );
      setDetails(data);
    } catch (err) {
      console.error("Failed to load trap OID details:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const update = useCallback(async (name, payload) => {
    if (!keycloak?.authenticated || !name) return;

    setLoading(true);
    setError(null);

    try {
      const updated = await kcFetch(
        keycloak,
        `/traps/trapOids/${encodeURIComponent(name)}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      setDetails(updated);
      return updated;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const remove = useCallback(async (name) => {
    if (!keycloak?.authenticated || !name) return;

    setLoading(true);
    setError(null);

    try {
      await kcFetch(
        keycloak,
        `/traps/trapOids/${encodeURIComponent(name)}/`,
        { method: "DELETE" }
      );
      setDetails(null);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const create = useCallback(async (payload) => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const created = await kcFetch(
        keycloak,
        `/traps/trapOids/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      setDetails(created);
      return created;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak]);


  useEffect(() => {
    loadList();
  }, []);

  return {
    list,
    details,
    loading,
    error,
    loadList,
    get,
    create,
    update,
    remove,
  };
}