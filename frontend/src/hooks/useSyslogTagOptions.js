import { useState } from "react";
import kcFetch from '../components/misc/kcFetch';

export function useSyslogTagOptions(keycloak) {
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState({});

  const loadOptions = async (tagName) => {
    // prevent duplicate calls
    if (options[tagName]) return;

    setLoading(prev => ({ ...prev, [tagName]: true }));

    try {
      const res = await kcFetch(
        keycloak,
        `/syslogs/options/${tagName}`
      );

      // ✅ normalize EVERYTHING here
      const normalized = (res || []).map(item => {
        // case 1: backend returns string
        if (typeof item === "string") {
          return { value: item, label: item };
        }

        // case 2: backend returns object
        return {
          value: item.value,
          label: item.label ?? item.value
        };
      });

      setOptions(prev => ({
        ...prev,
        [tagName]: normalized
      }));

    } catch (err) {
      console.error(`Error loading options for ${tagName}:`, err);
    } finally {
      setLoading(prev => ({ ...prev, [tagName]: false }));
    }
  };

  return {
    options,
    loading,
    loadOptions
  };
}