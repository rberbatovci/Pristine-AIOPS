import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useSnmpTrapOids(keycloak, autoLoad = true) {
  const [snmpTrapOids, setSnmpTrapOids] = useState([]);
  const [selectedTrapOid, setSelectedTrapOid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch list
  const fetchSnmpTrapOids = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const data = await kcFetch(keycloak, `/traps/trapOids/`);
      setSnmpTrapOids(data);
    } catch (err) {
      console.error("Error fetching SNMP Trap OIDs:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  // Fetch details
  const fetchTrapOidDetails = useCallback(async (id) => {
    if (!keycloak?.authenticated) return;

    try {
      const data = await kcFetch(keycloak, `/traps/trapOids/${id}/`);
      setSelectedTrapOid(data);
      return data;
    } catch (err) {
      console.error("Error fetching trap OID details:", err);
      setError(err);
    }
  }, [keycloak]);

  // Update
  const updateTrapOid = useCallback(async (id, payload) => {
    try {
      const data = await kcFetch(keycloak, `/traps/trapOids/${id}/`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setSnmpTrapOids((prev) =>
        prev.map((item) => (item.id === id ? data : item))
      );

      return data;
    } catch (err) {
      console.error("Error updating trap OID:", err);
      setError(err);
    }
  }, [keycloak]);

  // Delete one
  const deleteTrapOid = useCallback(async (id) => {
    try {
      await kcFetch(keycloak, `/traps/trapOids/${id}/`, {
        method: "DELETE",
      });

      setSnmpTrapOids((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Error deleting trap OID:", err);
      setError(err);
    }
  }, [keycloak]);

  // Delete all
  const deleteAllTrapOids = useCallback(async () => {
    try {
      await kcFetch(keycloak, `/traps/trapOids/`, {
        method: "DELETE",
      });

      setSnmpTrapOids([]);
      setSelectedTrapOid(null);
    } catch (err) {
      console.error("Error deleting all trap OIDs:", err);
      setError(err);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad && keycloak?.authenticated) {
      fetchSnmpTrapOids();
    }
  }, [fetchSnmpTrapOids, autoLoad, keycloak?.authenticated]);

  return {
    snmpTrapOids,
    selectedTrapOid,
    loading,
    error,

    fetchTrapOidDetails,
    updateTrapOid,
    deleteTrapOid,
    deleteAllTrapOids,
    reload: fetchSnmpTrapOids,
  };
}