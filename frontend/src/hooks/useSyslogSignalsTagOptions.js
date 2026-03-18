import { useState, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useSyslogSignalsTagOptions(keycloak) {
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState({});

  const fetchOptions = useCallback(
    async (tagName) => {
      if (!keycloak?.authenticated || options[tagName]) return;

      setLoading(prev => ({ ...prev, [tagName]: true }));
      setError(prev => ({ ...prev, [tagName]: null }));

      try {
        let endpoint;

        switch (tagName) {
          case "mnemonic":
            endpoint = "/signals/syslogs/mnemonics/options";
            break;
          case "rule":
            endpoint = "/signals/syslogs/rules/options";
            break;
          case "device":
            endpoint = "/signals/syslogs/devices/options";
            break;
          default:
            endpoint = `/signals/syslogs/affected-entities/options/${tagName}`;
        }

        const data = await kcFetch(keycloak, endpoint);

        const values = Array.isArray(data)
          ? data
          : data?.values || [];

        setOptions(prev => ({
          ...prev,
          [tagName]: values.map(v => ({
            value: v,
            label: v
          }))
        }));
      } catch (err) {
        console.error(`Failed to load options for ${tagName}`, err);
        setError(prev => ({ ...prev, [tagName]: err }));
      } finally {
        setLoading(prev => ({ ...prev, [tagName]: false }));
      }
    },
    [keycloak, options]
  );

  return {
    options,
    loading,
    error,
    fetchOptions
  };
}
