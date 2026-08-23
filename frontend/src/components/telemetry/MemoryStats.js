import React, { useMemo } from "react";
import "../../css/SignalInfo.css";
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

// Preset color palette to visually differentiate dynamic memory lines
const LINE_COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#a83279",
  "#32a8a4", "#6f42c1", "#fd7e14", "#20c997", "#17a2b8"
];

const MemoryStats = ({
  currentUser,
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
    path: "/telemetry/memory-statistics/",
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
    pattern: "set:device:*:memory",
    enabled: !selectedDevice,
  });

  /*
   * Get all unique memory types returned by OpenSearch for detailed device view.
   */
  const memoryTypes = useMemo(() => {
    if (!detailData || !Array.isArray(detailData)) return [];
    return [...new Set(detailData.map((item) => item.memory).filter(Boolean))];
  }, [detailData]);

  /*
   * Convert OpenSearch historical data into line-chart format.
   */
  const memoryStatistics = useMemo(() => {
    if (!detailData || !Array.isArray(detailData)) return [];
    const grouped = {};

    detailData.forEach((item) => {
      const timestamp = item.timestamp;
      if (!timestamp) return;

      if (!grouped[timestamp]) {
        grouped[timestamp] = {
          timestamp,
          displayTimestamp: moment(timestamp).format("HH:mm:ss"),
        };
      }

      const memory = item.memory;
      if (!memory) return;

      grouped[timestamp][`${memory}-free`] = item.stats?.["free-memory"] ?? 0;
      grouped[timestamp][`${memory}-used`] = item.stats?.["used-memory"] ?? 0;
      grouped[timestamp][`${memory}-total`] = item.stats?.["total-memory"] ?? 0;
    });

    return Object.values(grouped).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [detailData]);

  /*
   * Process Redis snapshot telemetry for all-devices dashboard view.
   */
  const dashboardMemoryData = useMemo(() => {
    if (!redisData || redisData.length === 0) return [];

    return redisData.map((item) => {
      // Support stringified JSON from Redis GET responses
      const parsed = typeof item === "string" ? JSON.parse(item) : item;
      return {
        device: parsed.device || "Unknown",
        usedMemory: parsed.stats?.["used-memory"] ?? 0,
        freeMemory: parsed.stats?.["free-memory"] ?? 0,
        totalMemory: parsed.stats?.["total-memory"] ?? 0,
      };
    });
  }, [redisData]);

  /*
   * Calculate Y-axis range dynamically without call-stack overflow risk.
   */
  const yDomain = useMemo(() => {
    if (memoryStatistics.length === 0 || memoryTypes.length === 0) {
      return ["auto", "auto"];
    }

    let min = Infinity;
    let max = -Infinity;
    let hasValidData = false;

    memoryStatistics.forEach((item) => {
      memoryTypes.forEach((memory) => {
        const free = item[`${memory}-free`];
        const used = item[`${memory}-used`];
        const total = item[`${memory}-total`];

        [free, used, total].forEach((val) => {
          if (typeof val === "number" && Number.isFinite(val)) {
            if (val < min) min = val;
            if (val > max) max = val;
            hasValidData = true;
          }
        });
      });
    });

    if (!hasValidData) return ["auto", "auto"];

    return [
      Math.max(0, Math.floor(min * 0.95)),
      Math.ceil(max * 1.05),
    ];
  }, [memoryStatistics, memoryTypes]);

  /*
   * Generate chart lines dynamically with distinct stroke colors.
   */
  const lines = useMemo(() => {
    const result = [];
    let colorIndex = 0;

    memoryTypes.forEach((memory) => {
      result.push(
        {
          dataKey: `${memory}-free`,
          name: `${memory} - Free`,
          stroke: LINE_COLORS[colorIndex++ % LINE_COLORS.length],
        },
        {
          dataKey: `${memory}-used`,
          name: `${memory} - Used`,
          stroke: LINE_COLORS[colorIndex++ % LINE_COLORS.length],
        },
        {
          dataKey: `${memory}-total`,
          name: `${memory} - Total`,
          stroke: LINE_COLORS[colorIndex++ % LINE_COLORS.length],
        }
      );
    });

    return result;
  }, [memoryTypes]);

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
      <div style={{ paddingTop: "10px" }}>
        {isLoading ? (
          <div className="p-4 text-gray-500 text-center">
            Loading memory statistics...
          </div>
        ) : isError ? (
          <div className="p-4 text-red-500 text-center">
            {isError}
          </div>
        ) : selectedDevice ? (
          /* ================= DEVICE DETAIL VIEW (LINE CHART) ================= */
          memoryStatistics.length === 0 ? (
            <div className="p-4 text-center">
              No memory statistics found for {selectedDevice}.
            </div>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={memoryStatistics}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="displayTimestamp" />
                  <YAxis domain={yDomain} />
                  <Tooltip />
                  <Legend />
                  {lines.map((line) => (
                    <Line
                      key={line.dataKey}
                      type="monotone"
                      dataKey={line.dataKey}
                      stroke={line.stroke}
                      dot={false}
                      activeDot={{ r: 4 }}
                      name={line.name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )
        ) : (
          /* ================= DASHBOARD OVERVIEW (BAR CHART) ================= */
          dashboardMemoryData.length === 0 ? (
            <div className="p-4 text-center">
              No active Redis memory metrics found across devices.
            </div>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dashboardMemoryData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="device" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="usedMemory" fill="#8884d8" name="Used Memory" />
                  <Bar dataKey="freeMemory" fill="#82ca9d" name="Free Memory" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default MemoryStats;