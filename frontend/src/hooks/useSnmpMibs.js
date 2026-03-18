import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useMibs(keycloak) {
  const [mibs, setMibs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMibs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await kcFetch(keycloak, "/traps/mibs");
      setMibs(res.mibs || []);
    } catch (err) {
      setError(err.message);
      console.error("Error fetching MIBs:", err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  const uploadMib = useCallback(async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);

      const res = await kcFetch(keycloak, "/traps/mibs/", {
        method: "POST",
        body: formData
      });

      await fetchMibs();

      return res;
    } catch (err) {
      setError(err.message);
      console.error("Upload error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [keycloak, fetchMibs]);

  const deleteMib = useCallback(async (filename) => {
    try {
      setLoading(true);

      await kcFetch(keycloak, `/traps/mibs/${filename}`, {
        method: "DELETE"
      });

      await fetchMibs();
    } catch (err) {
      setError(err.message);
      console.error("Delete error:", err);
    } finally {
      setLoading(false);
    }
  }, [keycloak, fetchMibs]);

  return {
    mibs,
    loading,
    error,
    fetchMibs,
    uploadMib,
    deleteMib
  };
}