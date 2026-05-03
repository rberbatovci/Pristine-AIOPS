import { useState, useEffect, useCallback } from 'react';
import kcFetch from '../components/misc/kcFetch'; 

export function useTopologyData(keycloak, autoLoad = true) {
  const [topologyData, setTopologyData] = useState({ nodes: [], links: [], prefixes: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTopologyData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(
        keycloak,
        `/topology/data`
      );

      setTopologyData(response);
    } catch (err) {
      console.error("Error fetching topology data:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad) fetchTopologyData();
  }, [fetchTopologyData, autoLoad]);

  return { topologyData, loading, error, reload: fetchTopologyData };
}