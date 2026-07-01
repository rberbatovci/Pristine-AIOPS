import { useState } from "react";
import kcFetch from "../components/misc/kcFetch";

export default function useDeviceDeepScan(keycloak) {
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState("");

  const pollScanStatus = async (scanId) => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const response = await kcFetch(keycloak, `/scans/${scanId}`, { method: "GET" });
          if (response.status === "completed") {
            clearInterval(interval);
            resolve(response.results);
          } else if (response.status === "failed") {
            clearInterval(interval);
            reject(new Error(response.error || "Deep device scan failed."));
          }
        } catch (err) {
          clearInterval(interval);
          reject(new Error("Failed communicating with the status endpoint."));
        }
      }, 2000);
    });
  };

  const deepScanDevice = async (ipAddress) => {
    setLoading(true);
    setError("");
    setScanResult(null);
    try {
      const initResponse = await kcFetch(keycloak, "/scans/device-deep", {
        method: "POST",
        body: JSON.stringify({ ip_address: ipAddress }),
      });

      const finalResults = await pollScanStatus(initResponse.scan_id);
      setScanResult(finalResults);
      return finalResults;
    } catch (err) {
      setError(err.message || "Failed running deep scan.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, scanResult, setScanResult, error, setError, deepScanDevice };
}