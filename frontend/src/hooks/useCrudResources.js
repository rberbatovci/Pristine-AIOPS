import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useCrudResource({
  keycloak,
  basePath,
  idField = "id",
  autoLoad = true
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = async (method, path = "", body) => {
    return kcFetch(keycloak, `${basePath}${path}`, {
      method,
      body
    });
  };

  const list = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const data = await request("GET");
      setItems(data);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak, basePath]);

  const get = useCallback(async (id) => {
    return request("GET", `/${id}`);
  }, []);

  const create = useCallback(async (payload) => {
    const created = await request("POST", "", payload);
    setItems(prev => [...prev, created]);
    return created;
  }, []);

  const update = useCallback(async (id, payload) => {
    const updated = await request("PATCH", `/${id}`, payload);
    setItems(prev =>
      prev.map(item =>
        item[idField] === updated[idField] ? updated : item
      )
    );
    return updated;
  }, [idField]);

  const remove = useCallback(async (id) => {
    await request("DELETE", `/${id}`);
    setItems(prev =>
      prev.filter(item => item[idField] !== id)
    );
  }, [idField]);

  const replaceItem = useCallback((updated) => {
    setItems(prev =>
      prev.map(item =>
        item[idField] === updated[idField] ? updated : item
      )
    );
  }, [idField]);

  const reset = () => setItems([]);

  return {
    items,
    loading,
    error,
    list,
    get,
    create,
    update,
    remove,
    replaceItem,
    setItems,
    reset
  };
}