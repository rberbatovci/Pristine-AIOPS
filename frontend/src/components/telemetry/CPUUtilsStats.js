import React, { useEffect, useState } from "react";
import kcFetch from "../misc/kcFetch";
import moment from "moment";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CpuUtilsStats = ({ selectedDevice, keycloak }) => {
  const [showData, setShowData] = useState(true);
  const [cpuData, setCpuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedDevice) {
      setShowData(false);
      setCpuData([]);
    } else {
      setShowData(true);
    }
  }, [selectedDevice]);

  useEffect(() => {
    const fetchCpuStats = async () => {
      if (!keycloak?.authenticated || !selectedDevice) return;

      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams({
          device: selectedDevice,
        }).toString();

        const data = await kcFetch(
          keycloak,
          `/telemetry/cpu-utilization/?${query}`
        );

        const formatted = data.results.map((item) => ({
          timestamp: moment(item.timestamp).format("HH:mm:ss"),
          fiveSeconds: item.stats?.["five-seconds"] ?? 0,
          oneMinute: item.stats?.["one-minute"] ?? 0,
          fiveMinutes: item.stats?.["five-minutes"] ?? 0,
        }));

        setCpuData(formatted);

      } catch (err) {
        console.error("Failed to fetch CPU stats:", err);
        setError("Failed to load CPU stats.");
      } finally {
        setLoading(false);
      }
    };

    fetchCpuStats();

  }, [selectedDevice, keycloak]);

  return (
    <div
      className="mainContainer"
      style={{ maxHeight: '220px', marginBottom: '10px', width: '100%' }}
    >
      <div style={{ paddingTop: "10px" }}>
        {loading ? (
          <div className="p-4 text-gray-500">Loading CPU stats...</div>
        ) : error ? (
          <div className="p-4 text-red-500">{error}</div>
        ) : cpuData.length === 0 ? (
          <div className="p-4">No CPU stats found for this device.</div>
        ) : (
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={cpuData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="timestamp" reversed />
                <YAxis domain={[0, 100]} />
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
        )}
      </div>
    </div>
  );
};

export default CpuUtilsStats;
