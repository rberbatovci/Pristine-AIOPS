import kcFetch from "../components/misc/kcFetch";

export const pushConfiguration = async ({
  keycloak,
  device,
  featureKey,
  endpoint,
  showNotification,
  payload = {}
}) => {
  if (!device?.hostname) {
    throw new Error("No device selected");
  }

  const hostname = device.hostname;

  showNotification(
    `Configuring ${featureKey.replace('_', ' ')} telemetry on ${hostname}...`,
    "loading"
  );

  try {
    await kcFetch(
      keycloak,
      `/devices/${hostname}/configure/${endpoint}/`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );

    showNotification(
      `${featureKey.replace('_', ' ')} telemetry applied successfully on ${hostname}`,
      "success"
    );
  } catch (err) {
    showNotification(
      `Failed to apply ${featureKey.replace('_', ' ')} telemetry on ${hostname}`,
      "error"
    );
    throw err;
  }
};
