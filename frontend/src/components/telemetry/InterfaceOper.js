import React, { useMemo, useEffect, useState } from "react";
import "../../css/SignalInfo.css";
import kcFetch from "../misc/kcFetch";
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

const STATUS_MAP = {
  "if-oper-state-ready": 1,
  "if-oper-state-no-pass": 0,
  "": null,
};

const COLOR_PALETTE = [
  "#8884d8",
  "#82ca9d",
  "#ff7300",
  "#0088FE",
  "#00C49F",
];

const InterfaceOper = ({
  keycloak,
  currentUser,
  selectedDevice,
  startTime,
  endTime,
}) => {
  const [availableInterfaces, setAvailableInterfaces] = useState([]);

  /*
   * 1. Fetch detailed historical status data when a specific device is selected.
   */
  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
  } = useTelemetryData({
    keycloak,
    path: "/telemetry/interface-oper-status/",
    device: selectedDevice,
    startTime,
    endTime,
    limit: 500,
    enabled: !!selectedDevice,
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
    pattern: "set:device:*:oper-status",
    enabled: !selectedDevice,
  });

  /*
   * Fetch available interfaces for the selected device.
   */
  useEffect(() => {
    let isSubscribed = true;

    const fetchInterfaces = async () => {
      if (!selectedDevice || !keycloak?.authenticated) {
        if (isSubscribed) setAvailableInterfaces([]);
        return;
      }

      try {
        const query = new URLSearchParams({
          device: selectedDevice,
        }).toString();

        const response = await kcFetch(
          keycloak,
          `/telemetry/interface-oper-status/interfaces/?${query}`
        );

        const ifaceList = (response?.interfaces || []).filter(
          (iface) => iface && iface.trim() !== ""
        );

        if (isSubscribed) {
          setAvailableInterfaces(ifaceList);
        }
      } catch (err) {
        console.error("Error fetching interfaces:", err);
        if (isSubscribed) setAvailableInterfaces([]);
      }
    };

    fetchInterfaces();

    return () => {
      isSubscribed = false;
    };
  }, [selectedDevice, keycloak]);

  /*
   * Convert OpenSearch records into Recharts data structure for single device view.
   */
  const interfaceStatistics = useMemo(() => {
    if (!detailData || detailData.length === 0) return [];

    const grouped = {};

    detailData.forEach((item) => {
      if (!item.timestamp || !item.interface) {
        return;
      }

      const timestamp = item.timestamp;

      if (!grouped[timestamp]) {
        grouped[timestamp] = {
          timestamp,
          displayTimestamp: moment(timestamp).format("HH:mm:ss"),
        };
      }

      grouped[timestamp][item.interface] =
        STATUS_MAP[item.status] ?? null;
    });

    return Object.values(grouped).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [detailData]);

  /*
   * Process Redis snapshot telemetry for all-devices dashboard view.
   * Summarizes operational statuses into total Up/Down interface counts.
   */
  const dashboardOperData = useMemo(() => {
    if (!redisData || redisData.length === 0) return [];

    return redisData.map((item) => {
      // Support stringified JSON from Redis GET responses
      const parsed = typeof item === "string" ? JSON.parse(item) : item;
      const device = parsed.device || "Unknown";
      const interfaces = parsed.interfaces || [];

      let upCount = 0;
      let downCount = 0;

      if (Array.isArray(interfaces)) {
        interfaces.forEach((iface) => {
          const val = STATUS_MAP[iface.status];
          if (val === 1) upCount++;
          else if (val === 0) downCount++;
        });
      }

      return {
        device,
        upCount,
        downCount,
      };
    });
  }, [redisData]);

  const formatStatus = (value) => {
    if (value === 1) return "Up";
    if (value === 0) return "Down";
    return "";
  };

  /*
   * Generate Line configurations per available interface.
   * Dynamically falls back to telemetry data keys if endpoint interface list is empty.
   */
  const lines = useMemo(() => {
    let listToUse = availableInterfaces;

    if (listToUse.length === 0 && detailData?.length > 0) {
      const extractedKeys = new Set(
        detailData.map((i) => i.interface).filter(Boolean)
      );
      listToUse = Array.from(extractedKeys);
    }

    return listToUse.map((iface) => ({
      dataKey: iface,
      name: iface,
    }));
  }, [availableInterfaces, detailData]);

  const isLoading = selectedDevice ? detailLoading : redisLoading;
  const isError = selectedDevice ? detailError : redisError;

  return (
    <div
      className="mainContainer"
      style={{
        maxHeight: "240px",
        marginBottom: "10px",
        width: "100%",
      }}
    >
      <div style={{ paddingTop: "10px" }}>
        {isLoading ? (
          <div className="p-4 text-gray-500 text-center">
            Loading interface status...
          </div>
        ) : isError ? (
          <div className="p-4 text-red-500 text-center">
            {isError}
          </div>
        ) : selectedDevice ? (
          /* ================= DEVICE DETAIL VIEW (LINE CHART) ================= */
          interfaceStatistics.length === 0 ? (
            <div className="p-4 text-center">
              No interface status data available for {selectedDevice}.
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
                  <YAxis
                    domain={[0, 1]}
                    ticks={[0, 1]}
                    tickFormatter={formatStatus}
                  />
                  <Tooltip
                    formatter={(value) =>
                      value === 1
                        ? "Up"
                        : value === 0
                        ? "Down"
                        : ""
                    }
                  />
                  <Legend />
                  {lines.map((line, idx) => (
                    <Line
                      key={line.dataKey}
                      type="stepAfter"
                      dataKey={line.dataKey}
                      name={line.name}
                      stroke={COLOR_PALETTE[idx % COLOR_PALETTE.length]}
                      dot={false}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        ) : (
          /* ================= DASHBOARD OVERVIEW (BAR CHART) ================= */
          dashboardOperData.length === 0 ? (
            <div className="p-4 text-center">
              No active Redis operational status metrics found across devices.
            </div>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboardOperData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="device" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="upCount" fill="#82ca9d" name="Interfaces Up" />
                  <Bar dataKey="downCount" fill="#ff7300" name="Interfaces Down" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default InterfaceOper;