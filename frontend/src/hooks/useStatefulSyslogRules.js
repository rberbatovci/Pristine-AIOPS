import { useState, useCallback, useEffect } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useStatefulSyslogRules(keycloak, autoLoad = true) {
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState(null);
  const [ruleDetails, setRuleDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* =======================
     FETCH LIST
  ======================= */
  const loadRules = useCallback(async () => {
    if (!keycloak?.authenticated) return;

    setLoading(true);
    setError(null);

    try {
      const data = await kcFetch(
        keycloak,
        "/syslogs/signals/rules/stateful/"
      );
      setRules(data);
    } catch (err) {
      console.error("Failed to load syslog rules:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [keycloak]);

  useEffect(() => {
    if (autoLoad && keycloak?.authenticated) {
      loadRules();
    }
  }, [loadRules, autoLoad, keycloak?.authenticated]);

  /* =======================
     SELECT RULE (with details)
  ======================= */
  const selectRule = useCallback(
    async (rule) => {
      if (!rule) {
        setSelectedRule(null);
        setRuleDetails(null);
        return;
      }

      setSelectedRule(rule);
      setLoading(true);

      try {
        const data = await kcFetch(
          keycloak,
          `/syslogs/statefulrules/${rule.name}/`
        );
        setRuleDetails(data);
        return data;
      } catch (err) {
        console.error("Failed to load rule details:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [keycloak]
  );

  /* =======================
     ADD
  ======================= */
  const addRule = useCallback(
    async (payload) => {
      const data = await kcFetch(
        keycloak,
        "/syslogs/signals/rules/stateful/",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setRules(prev => [...prev, data]);
      setSelectedRule(data);
      setRuleDetails(data);

      return data;
    },
    [keycloak]
  );

  /* =======================
     UPDATE
  ======================= */
  const updateRule = useCallback(
    async (ruleName, payload) => {
      const data = await kcFetch(
        keycloak,
        `/syslogs/signals/rules/stateful/${ruleName}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      setRules(prev =>
        prev.map(r => (r.name === ruleName ? data : r))
      );
      setSelectedRule(data);
      setRuleDetails(data);

      return data;
    },
    [keycloak]
  );

  /* =======================
     DELETE
  ======================= */
  const deleteRule = useCallback(
    async (ruleName) => {
      await kcFetch(
        keycloak,
        `/syslogs/signals/rules/stateful/${ruleName}/`,
        {
          method: "DELETE",
        }
      );

      setRules(prev => prev.filter(r => r.name !== ruleName));
      setSelectedRule(null);
      setRuleDetails(null);
    },
    [keycloak]
  );

  return {
    rules,
    selectedRule,
    ruleDetails,
    loading,
    error,

    // actions
    reload: loadRules,
    selectRule,
    addRule,
    updateRule,
    deleteRule
  };
}
