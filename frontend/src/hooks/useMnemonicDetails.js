import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useMnemonicDetails(keycloak) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadMnemonic = useCallback(async (id) => {
    if (!keycloak?.authenticated || !id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await kcFetch(
        keycloak,
        `/syslogs/mnemonics/${id}/`
      );
      setDetails(data);
    } catch (err) {
      console.error("Failed to load mnemonic details:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const updateMnemonic = useCallback(async (id, payload) => {
    if (!keycloak?.authenticated || !id) return;

    setLoading(true);
    setError(null);

    try {
      const updated = await kcFetch(
        keycloak,
        `/syslogs/update/mnemonics/${id}/`,
        {
          method: "PUT",
          body: payload
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

  const deleteMnemonic = useCallback(async (id) => {
    if (!keycloak?.authenticated || !id) return;

    setLoading(true);
    setError(null);

    try {
      await kcFetch(
        keycloak,
        `/syslogs/mnemonics/${id}/`,
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

  return {
    details,
    loading,
    error,
    loadMnemonic,
    updateMnemonic,
    deleteMnemonic
  };
}
