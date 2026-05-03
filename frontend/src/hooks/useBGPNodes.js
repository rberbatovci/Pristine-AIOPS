import { useState, useEffect, useCallback } from 'react';
import kcFetch from '../components/misc/kcFetch'; 

export function useBGPNodes(keycloak, autoLoad = true) {
  const [bgpNodes, setBGPNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBGPNodes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(
        keycloak,
        `/topology/nodes`
      );

      setBGPNodes(response.nodes || []);
    } catch (err) {
      console.error("Error fetching BGP nodes:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad) fetchBGPNodes();
  }, [fetchBGPNodes, autoLoad]);

  return { bgpNodes, loading, error, reload: fetchBGPNodes };
}