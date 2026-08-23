
import { useState, useEffect, useRef } from 'react';
import {
  PiArrowDownDuotone,
  PiArrowUpDuotone,
  PiChartLineUpDuotone,
  PiWarningCircleDuotone,
  PiSquaresFourDuotone
} from "react-icons/pi";

import kcFetch from '../misc/kcFetch';
import '../../css/InterfaceStatisticsModern.css';

function InterfaceStatistics({ keycloak, selectedDevice }) {
  const [device, setDevice] = useState(selectedDevice);
  const [interfaces, setInterfaces] = useState([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [error, setError] = useState('');
  const ifaceOperSocketRef = useRef(null);
  const ifaceStatsSocketRef = useRef(null);

  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  const normalizeNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  };

  const normalizeOperInterface = (name, data = {}) => {
    const stats = data?.stats || {};

    const operStatus = stats["oper-status"];

    let status = null;

    if (operStatus === "if-oper-state-ready") {
      status = "UP";
    } else if (
      operStatus === "if-oper-state-no-pass"
    ) {
      status = "DOWN";
    }

    return {
      name,
      status
    };
  };

  const normalizeStatsInterface = (name, data = {}) => {
    const stats = data?.stats || {};

    return {
      name,

      rx_kbps: normalizeNumber(
        stats["rx-kbps"]
      ),

      rx_pps: normalizeNumber(
        stats["rx-pps"]
      ),

      tx_kbps: normalizeNumber(
        stats["tx-kbps"]
      ),

      tx_pps: normalizeNumber(
        stats["tx-pps"]
      )
    };
  };

  const mergeInitialInterfaceData = (
    operResponse,
    statsResponse
  ) => {
    const interfaceMap = new Map();

    if (
      operResponse &&
      typeof operResponse === "object" &&
      !Array.isArray(operResponse)
    ) {
      Object.entries(operResponse).forEach(
        ([name, data]) => {

          if (!name?.trim()) {
            return;
          }

          interfaceMap.set(
            name,
            normalizeOperInterface(
              name,
              data
            )
          );
        }
      );
    }

    if (
      statsResponse &&
      typeof statsResponse === "object" &&
      !Array.isArray(statsResponse)
    ) {
      Object.entries(statsResponse).forEach(
        ([name, data]) => {

          if (!name?.trim()) {
            return;
          }

          const stats =
            normalizeStatsInterface(
              name,
              data
            );

          const existing =
            interfaceMap.get(name);

          interfaceMap.set(name, {
            ...(existing || {
              name,
              status: null
            }),
            ...stats
          });
        }
      );
    }

    return Array.from(
      interfaceMap.values()
    );
  };

  const updateInterface = (
    interfaceName,
    updates
  ) => {
    if (!interfaceName?.trim()) {
      return;
    }

    setInterfaces((prev) => {
      const existingIndex =
        prev.findIndex(
          (intf) =>
            intf.name === interfaceName
        );

      if (existingIndex === -1) {
        return [
          ...prev,
          {
            name: interfaceName,
            status: null,

            rx_kbps: 0,
            rx_pps: 0,

            tx_kbps: 0,
            tx_pps: 0,

            ...updates
          }
        ];
      }

      return prev.map(
        (intf, index) => {
          if (
            index !== existingIndex
          ) {
            return intf;
          }

          return {
            ...intf,
            ...updates
          };
        }
      );
    });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchInterfaces = async () => {
      const hostname =
        selectedDevice?.hostname;

      if (!hostname) {
        setInterfaces([]);
        setError('');
        setInterfacesLoading(false);

        return;
      }

      setInterfacesLoading(true);
      setError('');

      try {

        const [
          operResult,
          statsResult
        ] = await Promise.allSettled([
          kcFetch(
            keycloak,
            `/devices/status/${hostname}/iface-oper/`
          ),

          kcFetch(
            keycloak,
            `/devices/status/${hostname}/iface-stats/`
          )
        ]);

        if (cancelled) {
          return;
        }

        let operResponse = {};
        let statsResponse = {};

        const errors = [];

        if (
          operResult.status === "fulfilled"
        ) {
          operResponse =
            operResult.value || {};
        } else {
          console.error(
            "Failed to fetch interface operational status:",
            operResult.reason
          );

          errors.push(
            "Failed to load interface operational status."
          );
        }

        if (
          statsResult.status === "fulfilled"
        ) {
          statsResponse =
            statsResult.value || {};
        } else {
          console.error(
            "Failed to fetch interface statistics:",
            statsResult.reason
          );

          errors.push(
            "Failed to load interface statistics."
          );
        }

        const mergedInterfaces =
          mergeInitialInterfaceData(
            operResponse,
            statsResponse
          );

        setInterfaces(
          mergedInterfaces
        );

        if (errors.length > 0) {
          setError(
            errors.join(" ")
          );
        } else {
          setError('');
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load interface data:",
          err
        );

        setError(
          err?.message ||
          "Failed to load interface statistics."
        );

        setInterfaces([]);
      } finally {
        if (!cancelled) {
          setInterfacesLoading(false);
        }
      }
    };

    fetchInterfaces();

    return () => {
      cancelled = true;
    };
  }, [
    selectedDevice?.hostname,
    keycloak
  ]);

  useEffect(() => {
    const hostname =
      selectedDevice?.hostname;

    if (!hostname) {
      return;
    }

    const protocol =
      window.location.protocol === "https:"
        ? "wss"
        : "ws";

    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/iface-oper?device=${encodeURIComponent(hostname)}`
    );

    ifaceOperSocketRef.current = ws;

    ws.onopen = () => {
      console.log(
        "🔌 Interface operational websocket connected"
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg =
          JSON.parse(event.data);

        console.log(
          "Interface operational update:",
          msg
        );

        if (
          msg.type !== "iface-oper"
        ) {
          return;
        }

        const interfaceName =
          msg.interface ??
          msg.name ??
          msg.iface;

        const stats =
          msg.stats ??
          msg.data ??
          {};

        if (
          !interfaceName?.trim()
        ) {
          console.warn(
            "Interface operational update has no interface name:",
            msg
          );

          return;
        }

        const operStatus =
          stats["oper-status"] ??
          stats.oper_status ??
          stats.status;

        let status = null;

        if (
          operStatus ===
          "if-oper-state-ready"
        ) {
          status = "UP";
        } else if (
          operStatus ===
          "if-oper-state-no-pass"
        ) {
          status = "DOWN";
        }

        if (status) {
          updateInterface(
            interfaceName,
            {
              status
            }
          );
        }
      } catch (err) {
        console.error(
          "Interface operational websocket parse error:",
          err
        );
      }
    };

    ws.onerror = (err) => {
      console.error(
        "Interface operational websocket error:",
        err
      );
    };

    ws.onclose = () => {
      console.log(
        "❌ Interface operational websocket disconnected"
      );
    };

    return () => {
      if (
        ifaceOperSocketRef.current === ws
      ) {
        ws.close();
        ifaceOperSocketRef.current =
          null;
      }
    };
  }, [
    selectedDevice?.hostname
  ]);
 

  useEffect(() => {
    const hostname =
      selectedDevice?.hostname;

    if (!hostname) {
      return;
    }

    const protocol =
      window.location.protocol === "https:"
        ? "wss"
        : "ws";

    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/iface-stats?device=${encodeURIComponent(hostname)}`
    );

    ifaceStatsSocketRef.current = ws; 

    ws.onopen = () => {
      console.log(
        "🔌 Interface statistics websocket connected"
      );
    };
    ws.onmessage = (event) => {
      try {
        const msg =
          JSON.parse(event.data);

        console.log(
          "Interface statistics update:",
          msg
        );
        if (
          msg.type !== "iface-stats"
        ) {
          return;
        }
        const interfaceName =
          msg.interface ??
          msg.name ??
          msg.iface;

        const stats =
          msg.stats ??
          msg.data ??
          {};

        if (
          !interfaceName?.trim()
        ) {
          console.warn(
            "Interface statistics update has no interface name:",
            msg
          );

          return;
        }
        updateInterface(
          interfaceName,
          {
            rx_kbps: normalizeNumber(
              stats["rx-kbps"]
            ),

            rx_pps: normalizeNumber(
              stats["rx-pps"]
            ),

            tx_kbps: normalizeNumber(
              stats["tx-kbps"]
            ),

            tx_pps: normalizeNumber(
              stats["tx-pps"]
            )
          }
        );
      } catch (err) {
        console.error(
          "Interface statistics websocket parse error:",
          err
        );
      }
    };

    ws.onerror = (err) => {
      console.error(
        "Interface statistics websocket error:",
        err
      );
    };

    ws.onclose = () => {
      console.log(
        "❌ Interface statistics websocket disconnected"
      );
    };

    return () => {
      if (
        ifaceStatsSocketRef.current === ws
      ) {
        ws.close();
        ifaceStatsSocketRef.current =
          null;
      }
    };
  }, [
    selectedDevice?.hostname
  ]);

  const enabled =
    device
      ?.features
      ?.telemetry
      ?.features
      ?.interface_stats;

  return (
    <div className="interface-stats-panel">

      <div className="info-header">
        <div className="header-title">
          <PiChartLineUpDuotone
            style={{
              color:
                "var(--textColor)",
              fontSize: "18px"
            }}
          />
          <h3
            style={{
              color:
                "var(--textColor)",
              fontSize: "14px"
            }}
          >
            Interface Metrics
          </h3>
        </div>
        <span className="interface-counter">
          Active Links{" "}
          {
            interfaces.filter(
              (intf) =>
                intf.status === "UP"
            ).length
          }
          /
          {interfaces.length}
        </span>
      </div>
      <div className="panel-content-scroll">
        {!enabled ? (
          <div className="telemetry-disabled-banner">
            <PiWarningCircleDuotone
              className="warning-icon"
            />
            <p>
              Interface telemetry metrics
              streaming is not configured or
              activated on this device node.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="metrics-error-banner">
                {error}
              </div>
            )}
            {interfacesLoading ? (
              <div className="panel-loading-state">
                <div className="loading-bar-pulse"></div>
                <p>
                  Loading interface telemetry...
                </p>
              </div>
            ) : interfaces.length === 0 ? (
              <div className="panel-empty-state">
                <PiSquaresFourDuotone />
                <p>
                  No interfaces found.
                </p>
              </div>
            ) : (
              <div className="interfaces-grid-list">
                {interfaces
                  .filter(
                    (intf) =>
                      intf.name?.trim()
                  )
                  .map((intf) => {
                    const isReady =
                      intf.status === "UP";
                    return (
                      <div
                        key={intf.name}
                        className={`interface-row-card ${
                          !isReady
                            ? "link-down"
                            : ""
                        }`}
                      >
                        <div className="interface-identity">
                          <span
                            className="interface-name"
                            title={intf.name}
                          >
                            {intf.name}
                          </span>
                          <span
                            className={`status-pill ${
                              isReady
                                ? "is-ready"
                                : "is-down"
                            }`}
                          >
                            {isReady
                              ? "READY"
                              : "DOWN"}
                          </span>
                        </div>
                        <div className="interface-telemetry-grid">
                          <div className="telemetry-lane rx-lane">
                            <div className="lane-label">
                              <PiArrowDownDuotone
                                className="lane-arrow"
                              />
                              <span>
                                RX Traffic
                              </span>
                            </div>
                            <div className="lane-metrics">
                              <span className="metric-primary">
                                {normalizeNumber(
                                  intf.rx_kbps
                                ).toLocaleString()}
                                <span className="metric-unit">
                                  {" "}kbps
                                </span>
                              </span>
                              <span className="metric-secondary">
                                {normalizeNumber(
                                  intf.rx_pps
                                ).toLocaleString()}
                                <span className="metric-unit">
                                  {" "}pps
                                </span>
                              </span>
                            </div>
                          </div>
                          <div className="telemetry-lane tx-lane">
                            <div className="lane-label">
                              <PiArrowUpDuotone
                                className="lane-arrow"
                              />
                              <span>
                                TX Traffic
                              </span>
                            </div>
                            <div className="lane-metrics">
                              <span className="metric-primary">
                                {normalizeNumber(
                                  intf.tx_kbps
                                ).toLocaleString()}
                                <span className="metric-unit">
                                  {" "}kbps
                                </span>
                              </span>
                              <span className="metric-secondary">
                                {normalizeNumber(
                                  intf.tx_pps
                                ).toLocaleString()}
                                <span className="metric-unit">
                                  {" "}pps
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InterfaceStatistics;
