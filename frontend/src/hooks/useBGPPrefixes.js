import { useState, useEffect, useCallback } from 'react';
import kcFetch from '../components/misc/kcFetch'; 

export function useBGPPrefixes(keycloak, autoLoad = true) {
  const [bgpPrefixes, setBGPPrefixes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBGPPrefixes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(
        keycloak,
        `/topology/prefixes`
      );

      setBGPPrefixes(response.prefixes || []);
    } catch (err) {
      console.error("Error fetching BGP prefixes:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad) fetchBGPPrefixes();
  }, [fetchBGPPrefixes, autoLoad]);

  return { bgpPrefixes, loading, error, reload: fetchBGPPrefixes };
}