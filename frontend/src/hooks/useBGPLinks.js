import { useState, useEffect, useCallback } from 'react';
import kcFetch from '../components/misc/kcFetch'; 

export function useBGPLinks(keycloak, autoLoad = true) {
  const [bgpLinks, setBGPLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBGPLinks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(
        keycloak,
        `/topology/links`
      );

      setBGPLinks(response.links || []);
    } catch (err) {
      console.error("Error fetching BGP links:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad) fetchBGPLinks();
  }, [fetchBGPLinks, autoLoad]);

  return { bgpLinks, loading, error, reload: fetchBGPLinks };
}