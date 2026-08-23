import { useState } from "react";
import kcFetch from "../components/misc/kcFetch";

export default function useNetworkScan(keycloak, showNotification) {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState("");

  const pollScanStatus = async (scanId) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const response = await kcFetch(
            keycloak,
            `/scans/${scanId}`,
            { method: "GET" }
          );

          if (response.status === "completed") {
            clearInterval(interval);
            resolve(response.results);
          } else if (response.status === "failed") {
            clearInterval(interval);
            reject(
              new Error(response.error || "Network sweep task failed.")
            );
          }
        } catch (err) {
          clearInterval(interval);
          reject(
            new Error("Failed communicating with the status endpoint.")
          );
        }
      }, 2000);
    });
  };

  const scanNetwork = async (cidrRange) => {
    setLoading(true);
    setError("");
    setDevices([]);

    try {
      const initResponse = await kcFetch(
        keycloak,
        "/scans/network-sweep",
        {
          method: "POST",
          body: JSON.stringify({
            target_range: cidrRange,
          }),
        }
      );

      showNotification(
        "Network scan initiated. This may take a few minutes.",
        "info"
      );

      const finalResults = await pollScanStatus(initResponse.scan_id);

      setDevices(finalResults);

      showNotification(
        `Network scan completed. Found ${finalResults.length} device(s).`,
        "success"
      );

      return finalResults;
    } catch (err) {
      showNotification(
        `Network scan failed: ${err.message}`,
        "error"
      );

      setError(err.message || "Failed to scan network.");

      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    devices,
    setDevices,
    error,
    setError,
    scanNetwork,
  };
}