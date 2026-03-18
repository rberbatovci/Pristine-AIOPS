import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "https://auth.pristine-aiops.local/auth",
  realm: "pristine-aiops",
  clientId: "app",
});

export default keycloak;
