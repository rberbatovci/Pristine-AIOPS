import { useState, useEffect, useCallback } from "react";
import kcFetch from "../components/misc/kcFetch";

export function useDevicePing(
    keycloak,
    devices,
    autoLoad = true,
    interval = 10000
) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchPing = useCallback(async () => {
        if (!keycloak?.authenticated || !devices?.length) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            /*
             * Get all current ping states from Redis
             * through the authenticated FastAPI endpoint.
             */
            const response = await kcFetch(
                keycloak,
                "/devices/status/ping"
            );

            const pingDevices = Array.isArray(response?.devices)
                ? response.devices
                : [];

            /*
             * ----------------------------------------------------
             * Build lookup maps
             * ----------------------------------------------------
             *
             * We use BOTH hostname and IP because the backend
             * response may contain either one.
             *
             * Example of valid data:
             *
             * hostname: CSR1kv-Router5
             * ip:       192.168.1.195
             *
             * We also protect against a malformed/stale record
             * where hostname and IP are reversed.
             */

            const pingByHostname = new Map();
            const pingByIp = new Map();

            pingDevices.forEach((ping) => {
                if (!ping) {
                    return;
                }

                const hostname =
                    typeof ping.hostname === "string"
                        ? ping.hostname.trim()
                        : "";

                const ip =
                    typeof ping.ip === "string"
                        ? ping.ip.trim()
                        : "";

                const normalizedHostname =
                    hostname.toLowerCase();

                /*
                 * Detect obviously reversed records.
                 *
                 * Example:
                 *
                 * hostname = "192.168.1.195"
                 * ip       = "CSR1kv-Router5"
                 *
                 * In this case, treat the IP as hostname
                 * and hostname as IP.
                 */
                const hostnameLooksLikeIp =
                    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

                const ipLooksLikeHostname =
                    ip &&
                    !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip);

                if (hostnameLooksLikeIp && ipLooksLikeHostname) {
                    /*
                     * This record is reversed.
                     */
                    const correctedPing = {
                        ...ping,
                        hostname: ip,
                        ip: hostname,
                    };

                    pingByHostname.set(
                        ip.toLowerCase(),
                        correctedPing
                    );

                    pingByIp.set(
                        hostname,
                        correctedPing
                    );

                    return;
                }

                /*
                 * Normal record.
                 */
                if (hostname) {
                    pingByHostname.set(
                        normalizedHostname,
                        ping
                    );
                }

                if (ip) {
                    pingByIp.set(ip, ping);
                }
            });

            /*
             * ----------------------------------------------------
             * Merge ping state with devices
             * ----------------------------------------------------
             */
            const updatedDevices = devices.map((device) => {
                if (!device) {
                    return device;
                }

                const hostname =
                    device.hostname ||
                    device.name ||
                    "";

                const ip =
                    device.ip_address ||
                    device.ip ||
                    "";

                /*
                 * First try hostname.
                 */
                let ping = hostname
                    ? pingByHostname.get(
                          hostname.toLowerCase()
                      )
                    : null;

                /*
                 * If hostname didn't match, try IP.
                 */
                if (!ping && ip) {
                    ping = pingByIp.get(ip);
                }

                /*
                 * If still no match, return unknown state.
                 */
                if (!ping) {
                    return {
                        ...device,
                        ping: {
                            status: "unknown",
                            rtt_ms: null,
                            timestamp: null,
                        },
                    };
                }

                /*
                 * Return the device with ping information.
                 */
                return {
                    ...device,
                    ping: {
                        status:
                            ping.status || "unknown",

                        rtt_ms:
                            ping.rtt_ms ??
                            null,

                        timestamp:
                            ping.timestamp ??
                            null,
                    },
                };
            });

            setData(updatedDevices);

        } catch (err) {
            console.error(
                "Failed to fetch device ping status:",
                err
            );

            setError(err);
        } finally {
            setLoading(false);
        }
    }, [keycloak, devices]);

    /*
     * ------------------------------------------------------------
     * Initial load + automatic polling
     * ------------------------------------------------------------
     */
    useEffect(() => {
        if (!autoLoad) {
            return;
        }

        fetchPing();

        if (interval > 0) {
            const timer = setInterval(
                fetchPing,
                interval
            );

            return () => {
                clearInterval(timer);
            };
        }
    }, [
        fetchPing,
        autoLoad,
        interval,
    ]);

    return {
        data,
        loading,
        error,
        reload: fetchPing,
    };
}

export default useDevicePing;