import React, { useState, useMemo, useEffect } from "react";
import "../../css/SignalInfo.css";
import kcFetch from "../misc/kcFetch";
import Select from "react-select";
import customStyles from "../misc/SelectStyles";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import moment from "moment";
import useTelemetryData from "../../hooks/useTelemetryData";
import useRedisTelemetryData from "../../hooks/useRedisTelemetryData";

const InterfaceStats = ({
  keycloak,
  currentUser,
  selectedDevice,
  startTime,
  endTime,
}) => {
  const [selectedInterface, setSelectedInterface] = useState(null);
  const [availableInterfaces, setAvailableInterfaces] = useState([]);

  /*
   * Memoize hook parameters to ensure stable object references.
   */
  const telemetryParams = useMemo(
    () => ({
      interface: selectedInterface?.value,
    }),
    [selectedInterface?.value]
  );

  /*
   * 1. Fetch detailed interface data when a specific device + interface is selected.
   */
  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
  } = useTelemetryData({
    keycloak,
    path: "/telemetry/interface-statistics/",
    device: selectedDevice,
    startTime,
    endTime,
    limit: 500,
    params: telemetryParams,
    enabled: !!selectedDevice && !!selectedInterface?.value,
  });

  /*
   * 2. Fetch snapshot telemetry from Redis when NO device is selected (Dashboard mode).
   */
  const {
    data: redisData,
    loading: redisLoading,
    error: redisError,
  } = useRedisTelemetryData({
    keycloak,
    pattern: "set:device:*:interface",
    enabled: !selectedDevice,
  });

  /*
   * Fetch available interfaces when single device is selected.
   */
  useEffect(() => {
    let isSubscribed = true;

    const fetchInterfaces = async () => {
      if (!selectedDevice || !keycloak?.authenticated) {
        if (isSubscribed) {
          setAvailableInterfaces([]);
          setSelectedInterface(null);
        }
        return;
      }

      try {
        const query = new URLSearchParams({
          device: selectedDevice,
        }).toString();

        const response = await kcFetch(
          keycloak,
          `/telemetry/interface-statistics/interfaces/?${query}`
        );

        const options = (response?.interfaces || [])
          .filter((iface) => iface && iface.trim() !== "")
          .map((iface) => ({
            value: iface,
            label: iface,
          }));

        if (isSubscribed) {
          setAvailableInterfaces(options);

          /*
           * Automatically select the first interface if not selected or invalid.
           */
          if (options.length > 0) {
            setSelectedInterface((prev) =>
              options.some((opt) => opt.value === prev?.value) ? prev : options[0]
            );
          } else {
            setSelectedInterface(null);
          }
        }
      } catch (err) {
        console.error("Error fetching interfaces:", err);
        if (isSubscribed) {
          setAvailableInterfaces([]);
          setSelectedInterface(null);
        }
      }
    };

    fetchInterfaces();

    return () => {
      isSubscribed = false;
    };
  }, [selectedDevice, keycloak]);

  /*
   * Format historical OpenSearch telemetry data for detailed LineChart view.
   */
  const interfaceStatistics = useMemo(() => {
    if (!detailData || detailData.length === 0) return [];

    return detailData
      .map((item) => ({
        timestamp: item.timestamp,
        displayTimestamp: moment(item.timestamp).format("HH:mm:ss"),
        discontinuityTime: item.stats?.["discontinuity-time"] ?? 0,
        inOctets: item.stats?.["in-octets"] ?? 0,
        inUnicastPkts: item.stats?.["in-unicast-pkts"] ?? 0,
        inBroadcastPkts: item.stats?.["in-broadcast-pkts"] ?? 0,
        inMulticastPkts: item.stats?.["in-multicast-pkts"] ?? 0,
        inDiscards: item.stats?.["in-discards"] ?? 0,
        inErrors: item.stats?.["in-errors"] ?? 0,
        inUnknownProtos: item.stats?.["in-unknown-protos"] ?? 0,
        outOctets: item.stats?.["out-octets"] ?? 0,
        outUnicastPkts: item.stats?.["out-unicast-pkts"] ?? 0,
        outBroadcastPkts: item.stats?.["out-broadcast-pkts"] ?? 0,
        outMulticastPkts: item.stats?.["out-multicast-pkts"] ?? 0,
        outDiscards: item.stats?.["out-discards"] ?? 0,
        outErrors: item.stats?.["out-errors"] ?? 0,
        rxPps: item.stats?.["rx-pps"] ?? 0,
        rxKbps: item.stats?.["rx-kbps"] ?? 0,
        txPps: item.stats?.["tx-pps"] ?? 0,
        txKbps: item.stats?.["tx-kbps"] ?? 0,
        numFlaps: item.stats?.["num-flaps"] ?? 0,
        inCrcErrors: item.stats?.["in-crc-errors"] ?? 0,
        inDiscards64: item.stats?.["in-discards-64"] ?? 0,
        inErrors64: item.stats?.["in-errors-64"] ?? 0,
        inUnknownProtos64: item.stats?.["in-unknown-protos-64"] ?? 0,
        outOctets64: item.stats?.["out-octets-64"] ?? 0,
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [detailData]);

  /*
   * Process Redis snapshot telemetry for all-devices dashboard view.
   */
  const dashboardInterfaceData = useMemo(() => {
    if (!redisData || redisData.length === 0) return [];

    return redisData.map((item) => {
      // Support stringified JSON from Redis GET responses
      const parsed = typeof item === "string" ? JSON.parse(item) : item;
      return {
        device: parsed.device || "Unknown",
        rxKbps: parsed.stats?.["rx-kbps"] ?? 0,
        txKbps: parsed.stats?.["tx-kbps"] ?? 0,
        inErrors: parsed.stats?.["in-errors"] ?? 0,
        outErrors: parsed.stats?.["out-errors"] ?? 0,
      };
    });
  }, [redisData]);

  /*
   * Dynamically calculate Y-axis domain for detailed view using loop-based min/max.
   */
  const yDomain = useMemo(() => {
    if (interfaceStatistics.length === 0) return [0, "auto"];

    let min = Infinity;
    let max = -Infinity;
    let hasValidData = false;

    interfaceStatistics.forEach((item) => {
      const fields = [
        item.inOctets, item.outOctets, item.inUnicastPkts, item.outUnicastPkts,
        item.inDiscards, item.outDiscards, item.inErrors, item.outErrors,
        item.rxPps, item.txPps, item.rxKbps, item.txKbps,
      ];

      fields.forEach((val) => {
        if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
          if (val < min) min = val;
          if (val > max) max = val;
          hasValidData = true;
        }
      });
    });

    if (!hasValidData) return [0, "auto"];

    return [
      Math.max(0, Math.floor(min * 0.95)),
      Math.ceil(max * 1.05),
    ];
  }, [interfaceStatistics]);

  const isLoading = selectedDevice ? detailLoading : redisLoading;
  const isError = selectedDevice ? detailError : redisError;

  return (
    <div
      className="mainContainer"
      style={{
        maxHeight: "300px",
        marginBottom: "10px",
        width: "100%",
      }}
    >
      {/* Interface selector visible only when a device is selected */}
      {selectedDevice && (
        <div>
          <div className="zoom-buttons-container">
            <div
              className="headerButtons"
              style={{
                display: "flex",
                gap: "10px",
              }}
            >
              <Select
                onChange={(option) => setSelectedInterface(option)}
                options={availableInterfaces}
                placeholder="Select interface"
                styles={{
                  ...customStyles("190px"),
                  menuPortal: (base) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                }}
                value={selectedInterface}
                isClearable={true}
                menuPortalTarget={document.body}
                isDisabled={!selectedDevice}
              />
            </div>
          </div>
        </div>
      )}

      {/* Status views */}
      <div style={{ paddingTop: "10px" }}>
        {isLoading ? (
          <div className="p-4 text-gray-500 text-center">
            Loading interface statistics...
          </div>
        ) : isError ? (
          <div className="p-4 text-red-500 text-center">
            {isError}
          </div>
        ) : selectedDevice ? (
          /* ================= DEVICE DETAIL VIEW (LINE CHART) ================= */
          !selectedInterface ? (
            <div className="p-4 text-center">
              Please select an interface to view statistics.
            </div>
          ) : interfaceStatistics.length === 0 ? (
            <div className="p-4 text-center">
              No data available for the selected interface.
            </div>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={interfaceStatistics}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="displayTimestamp" />
                  <YAxis domain={yDomain} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="inOctets" stroke="#8884d8" dot={false} name="In Octets" />
                  <Line type="monotone" dataKey="outOctets" stroke="#82ca9d" dot={false} name="Out Octets" />
                  <Line type="monotone" dataKey="inUnicastPkts" stroke="#ffc658" dot={false} name="In Unicast Pkts" />
                  <Line type="monotone" dataKey="outUnicastPkts" stroke="#ff7300" dot={false} name="Out Unicast Pkts" />
                  <Line type="monotone" dataKey="inDiscards" stroke="#a83279" dot={false} name="In Discards" />
                  <Line type="monotone" dataKey="outDiscards" stroke="#32a8a4" dot={false} name="Out Discards" />
                  <Line type="monotone" dataKey="inErrors" stroke="#6f42c1" dot={false} name="In Errors" />
                  <Line type="monotone" dataKey="outErrors" stroke="#fd7e14" dot={false} name="Out Errors" />
                  <Line type="monotone" dataKey="rxPps" stroke="#20c997" dot={false} name="Rx PPS" />
                  <Line type="monotone" dataKey="txPps" stroke="#17a2b8" dot={false} name="Tx PPS" />
                  <Line type="monotone" dataKey="rxKbps" stroke="#6c757d" dot={false} name="Rx KBPS" />
                  <Line type="monotone" dataKey="txKbps" stroke="#007bff" dot={false} name="Tx KBPS" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        ) : (
          /* ================= DASHBOARD OVERVIEW (BAR CHART) ================= */
          dashboardInterfaceData.length === 0 ? (
            <div className="p-4 text-center">
              No active Redis interface metrics found across devices.
            </div>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboardInterfaceData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="device" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rxKbps" fill="#8884d8" name="Rx (Kbps)" />
                  <Bar dataKey="txKbps" fill="#82ca9d" name="Tx (Kbps)" />
                  <Bar dataKey="inErrors" fill="#a83279" name="In Errors" />
                  <Bar dataKey="outErrors" fill="#fd7e14" name="Out Errors" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default InterfaceStats;