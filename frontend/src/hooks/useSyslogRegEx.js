import { useState, useEffect, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useSyslogRegEx({ keycloak, autoLoad = true } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generic request wrapper
   */
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

  /**
   * GET all regex rules
   */
  const list = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const data = await request("GET", "/");
      setItems(data || []);
      return data;
    } catch (err) {
      setError(err.message || "Failed to fetch regex rules");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak, request]);

  /**
   * GET single regex rule
   */
  const get = useCallback(
    async (name) => {
      try {
        return await request("GET", `/${name}`);
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [request]
  );

  /**
   * CREATE regex rule
   */
  const create = useCallback(
    async (payload) => {
      try {
        const created = await request("POST", "/", payload);
        setItems(prev => [...prev, created]);
        return created;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [request]
  );

  /**
   * UPDATE regex rule
   */
  const update = useCallback(
    async (name, payload) => {
      try {
        const updated = await request("PUT", `/${name}/`, payload);

        setItems(prev =>
          prev.map(item =>
            item.name === updated.name ? updated : item
          )
        );

        return updated;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [request]
  );

  /**
   * DELETE regex rule
   */
  const remove = useCallback(
    async (name) => {
      try {
        await request("DELETE", `/${name}/`);

        setItems(prev =>
          prev.filter(item => item.name !== name)
        );
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [request]
  );

  /**
   * Sync to Redis
   */
  const syncToRedis = useCallback(async () => {
    try {
      await kcFetch(keycloak, `/syslogs/regex/handleSyncToRedis/`, {
        method: "POST"
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [keycloak]);

  /**
   * Auto-load on mount
   */
  useEffect(() => {
    if (autoLoad && keycloak?.authenticated) {
      list();
    }
  }, [autoLoad, keycloak, list]);

  return {
    regExRules: items,
    loading,
    error,
    list,
    get,
    create,
    update,
    remove,
    syncToRedis,
    setItems
  };
}