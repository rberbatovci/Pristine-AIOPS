import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export const useTrapSignalsTagOptions = () => {
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});

  const fetchOptions = useCallback(async (entityName) => {
    if (options[entityName] || loading[entityName]) return;

    setLoading(prev => ({ ...prev, [entityName]: true }));
    setError(prev => ({ ...prev, [entityName]: null }));

    try {
      const response = await kcFetch.get(
        `/signals/api/affected_entities/${entityName}/`
      );

      const values = response.data?.[entityName] ?? [];

      setOptions(prev => ({
        ...prev,
        [entityName]: values.map(v => ({
          value: v,
          label: v
        }))
      }));
    } catch (err) {
      console.error(`Failed to load ${entityName}`, err);
      setError(prev => ({
        ...prev,
        [entityName]: "Failed to load options"
      }));
    } finally {
      setLoading(prev => ({ ...prev, [entityName]: false }));
    }
  }, [options, loading]);

  return {
    options,
    loading,
    error,
    fetchOptions
  };
};