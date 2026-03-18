import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useSnmpTrapTags(keycloak, autoLoad = true) {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTags = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const data = await kcFetch(keycloak, "/traps/tags/");
      setTags(
        data.map(tag => ({
          value: tag.name,
          label: tag.name
        }))
      );
    } catch (err) {
      console.error("Failed to load SNMP trap tags:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad && keycloak?.authenticated) {
      loadTags();
    }
  }, [loadTags, autoLoad, keycloak?.authenticated]);

  return {
    tags,
    loading,
    error,
    reload: loadTags
  };
}
