import { useEffect } from "react";
import { useCrudResource } from "./useCrudResources";

export function useSnmpTrapOids2(keycloak, autoLoad = true) {
  const crud = useCrudResource({
    keycloak,
    basePath: "/traps/trapOids",
    autoLoad
  });

  useEffect(() => {
    if (autoLoad) {
      crud.list();
    }
  }, [autoLoad]);

  return {
    snmpTrapOids: crud.items,
    ...crud
  };
}