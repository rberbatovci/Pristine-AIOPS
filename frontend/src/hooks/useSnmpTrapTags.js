import { useState, useEffect, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

const PREDEFINED_TAGS = [
  { label: "Timestamp", value: "timestamp" },
  { label: "Device", value: "device" },
  { label: "System Uptime", value: "sysUpTime" },
  { label: "SNMP Trap OID", value: "snmpTrapOid" },
  { label: "Content", value: "content" },
];

export function useSnmpTrapTags(keycloak) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [details, setDetails] = useState(null);

  const loadList = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const data = await kcFetch(keycloak, "/traps/tags/");

      /*
       * Backend response:
       *
       * [
       *   { "name": "Interface" }
       * ]
       *
       * Convert it to the format used by the React component:
       *
       * [
       *   { label: "Interface", value: "Interface" }
       * ]
       */
      const apiTags = Array.isArray(data)
        ? data
            .filter((tag) => tag?.name)
            .map((tag) => ({
              label: tag.name,
              value: tag.name,
            }))
        : [];

      /*
       * Combine predefined tags + database tags.
       *
       * Database tags that have the same value as a predefined
       * tag will not be duplicated.
       */
      const combinedTags = [...PREDEFINED_TAGS, ...apiTags];

      const uniqueTags = [];
      const seen = new Set();

      for (const tag of combinedTags) {
        if (!seen.has(tag.value)) {
          seen.add(tag.value);
          uniqueTags.push(tag);
        }
      }

      setList(uniqueTags);
    } catch (err) {
      console.error("Failed to fetch SNMP trap tags:", err);

      setError(
        err?.message || "Failed to fetch SNMP trap tags"
      );
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const get = useCallback(
    async (name) => {
      if (!keycloak?.authenticated || !name) {
        console.warn(
          "Skipping GET: not authenticated or no name",
          { keycloak, name }
        );
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await kcFetch(
          keycloak,
          `/traps/tags/${encodeURIComponent(name)}`
        );

        setDetails(data);

        return data;
      } catch (err) {
        console.error(
          "Failed to load trap tag details:",
          err
        );

        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [keycloak]
  );

  const update = useCallback(
    async (name, payload) => {
      if (!keycloak?.authenticated || !name) return;

      setLoading(true);
      setError(null);

      try {
        const updated = await kcFetch(
          keycloak,
          `/traps/tags/${encodeURIComponent(name)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        setDetails(updated);

        // Refresh the list after updating a tag
        await loadList();

        return updated;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [keycloak, loadList]
  );

  const remove = useCallback(
    async (name) => {
      if (!keycloak?.authenticated || !name) return;

      setLoading(true);
      setError(null);

      try {
        await kcFetch(
          keycloak,
          `/traps/tags/${encodeURIComponent(name)}`,
          {
            method: "DELETE",
          }
        );

        setDetails(null);

        // Refresh the list after deleting
        await loadList();
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [keycloak, loadList]
  );

  const create = useCallback(
    async (payload) => {
      if (!keycloak?.authenticated) return;

      setLoading(true);
      setError(null);

      try {
        const created = await kcFetch(
          keycloak,
          "/traps/tags/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        setDetails(created);

        // Refresh the list after creating
        await loadList();

        return created;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [keycloak, loadList]
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  return {
    list,
    details,
    loading,
    error,
    loadList,
    get,
    create,
    update,
    remove,
  };
}