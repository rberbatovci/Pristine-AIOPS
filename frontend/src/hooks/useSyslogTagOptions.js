import { useState } from "react";
import kcFetch from "../misc/kcFetch";

const STATIC_ENDPOINTS = {
  mnemonic: "/signals/syslogs/mnemonics/options",
  rule: "/signals/syslogs/rules/options",
  device: "/signals/syslogs/devices/options",
};

export function useSyslogTagOptions(keycloak) {
  const [options, setOptions] = useState({});
  const [loading, setLoading] = useState({});

  const loadOptions = async (tagName) => {
    if (options[tagName]) return;

    setLoading(prev => ({ ...prev, [tagName]: true }));

    try {
      let data;

      if (STATIC_ENDPOINTS[tagName]) {
        data = await kcFetch(keycloak, STATIC_ENDPOINTS[tagName]);
        setOptions(prev => ({
          ...prev,
          [tagName]: data.map(v => ({ value: v, label: v }))
        }));
      } else {
        // affected entity fallback
        const res = await kcFetch(
          keycloak,
          `/signals/syslogs/affected-entities/options/${tagName}`
        );

        setOptions(prev => ({
          ...prev,
          [tagName]: (res.values || []).map(v => ({
            value: v,
            label: v
          }))
        }));
      }
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