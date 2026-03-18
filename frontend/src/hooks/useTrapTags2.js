import { useCrudResource } from "./useCrudResources";

export function useTrapTags2(keycloak) {
  return useCrudResource({
    keycloak,
    basePath: "/traps/tags",
    autoLoad: true
  });
}