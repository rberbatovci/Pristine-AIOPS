export default async function kcFetch(keycloak, url, options = {}) {
  if (!keycloak?.authenticated) {
    throw new Error("Keycloak not authenticated");
  }

  await keycloak.updateToken(30);

  const isFormData = options.body instanceof FormData;

  const headers = {
    Authorization: `Bearer ${keycloak.token}`,
    ...(options.headers || {})
  };

  // Only set JSON header when NOT uploading files
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.startsWith("/") ? `/api${url}` : url, {
    ...options,
    headers
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}