import React, { useMemo } from "react";
import moment from "moment";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

import useTelemetryData from "../../hooks/useTelemetryData";
import useRedisTelemetryData from "../../hooks/useRedisTelemetryData";

const CpuUtilsStats = ({
  selectedDevice,
  keycloak,
  startTime,
  endTime,
}) => {
  /*
   * 1. Fetch detailed historical data when a specific device is selected.
   */
  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
  } = useTelemetryData({
    keycloak,
    path: "/telemetry/cpu-utilization/",
    device: selectedDevice,
    startTime,
    endTime,
    limit: 100,
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
    pattern: "set:device:*:cpu",
    enabled: !selectedDevice,
  });

  /*
   * Process historical telemetry for single device view.
   */
  const historicalCpuData = useMemo(() => {
    if (!detailData || detailData.length === 0) return [];

    return detailData
      .map((item) => ({
        timestamp: moment(item.timestamp).format("HH:mm:ss"),
        rawTimestamp: item.timestamp,
        fiveSeconds: item.stats?.["five-seconds"] ?? 0,
        oneMinute: item.stats?.["one-minute"] ?? 0,
        fiveMinutes: item.stats?.["five-minutes"] ?? 0,
      }))
      .sort((a, b) => new Date(a.rawTimestamp) - new Date(b.rawTimestamp));
  }, [detailData]);

  /*
   * Process Redis snapshot telemetry for all-devices dashboard view.
   */
  const dashboardCpuData = useMemo(() => {
    if (!redisData || redisData.length === 0) return [];

    return redisData.map((item) => {
      // Support stringified JSON from Redis GET responses
      const parsed = typeof item === "string" ? JSON.parse(item) : item;
      return {
        device: parsed.device || "Unknown",
        fiveSeconds: parsed.stats?.["five-seconds"] ?? 0,
        oneMinute: parsed.stats?.["one-minute"] ?? 0,
        fiveMinutes: parsed.stats?.["five-minutes"] ?? 0,
      };
    });
  }, [redisData]);

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
            Loading CPU stats...
          </div>
        ) : isError ? (
          <div className="p-4 text-red-500 text-center">
            {isError}
          </div>
        ) : selectedDevice ? (
          /* ================= DEVICE DETAIL VIEW (LINE CHART) ================= */
          historicalCpuData.length === 0 ? (
            <div className="p-4 text-center">
              No CPU stats found for  selectedDevice .
            </div>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={historicalCpuData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="timestamp" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="fiveSeconds"
                    stroke="#8884d8"
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="5 Seconds"
                  />
                  <Line
                    type="monotone"
                    dataKey="oneMinute"
                    stroke="#82ca9d"
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="1 Minute"
                  />
                  <Line
                    type="monotone"
                    dataKey="fiveMinutes"
                    stroke="#ffc658"
                    dot={false}
                    activeDot={{ r: 4 }}
                    name="5 Minutes"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        ) : (
          /* ================= DASHBOARD OVERVIEW (BAR CHART) ================= */
          dashboardCpuData.length === 0 ? (
            <div className="p-4 text-center">
              No active Redis CPU metrics found across devices.
            </div>
          ) : (
            <div style={{ width: "100%", height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboardCpuData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="device" />
                  <YAxis domain={[0, 100]} unit="%" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="fiveSeconds" fill="#8884d8" name="5 Sec" />
                  <Bar dataKey="oneMinute" fill="#82ca9d" name="1 Min" />
                  <Bar dataKey="fiveMinutes" fill="#ffc658" name="5 Min" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default CpuUtilsStats;