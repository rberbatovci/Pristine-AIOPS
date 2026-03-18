import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useMnemonics(keycloak, autoLoad = true) {
  const [mnemonics, setMnemonics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMnemonics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await kcFetch(keycloak, `/syslogs/mnemonics/`);

      const mapped = response.map(mnemonic => ({
        id: mnemonic.id,
        name: mnemonic.name,
        label: mnemonic.name
      }));

      setMnemonics(mapped);
    } catch (err) {
      console.error("Error fetching mnemonic data:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad) {
      fetchMnemonics();
    }
  }, [fetchMnemonics, autoLoad]);

  return {
    mnemonics,
    loading,
    error,
    reload: fetchMnemonics
  };
}
