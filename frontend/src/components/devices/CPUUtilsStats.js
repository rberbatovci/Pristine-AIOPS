import React, { useEffect, useState } from "react";
import apiClient from "../misc/AxiosConfig";
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

const CpuUtilsStats = ({ selectedDevice }) => {
  const [showData, setShowData] = useState(false);
  const [cpuData, setCpuData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCpuStats = async () => {
      try {
        const res = await apiClient.get("/telemetry/cpu-utilization", {
          params: { selectedDevice },
        });

        const formatted = res.data.results.map((item) => ({
          timestamp: moment(item.ingested_at).format("HH:mm:ss"),
          fiveSeconds: item.stats?.["five-seconds"] ?? 0,
          oneMinute: item.stats?.["one-minute"] ?? 0,
          fiveMinutes: item.stats?.["five-minutes"] ?? 0,
        }));

        setCpuData(formatted);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch CPU stats:", err);
        setError("Failed to load CPU stats.");
        setLoading(false);
      }
    };

    if (selectedDevice) {
      fetchCpuStats();
    }
  }, [selectedDevice]);

  if (loading) return <div className="p-4 text-gray-500">Loading CPU stats...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;
  if (cpuData.length === 0) return <div className="p-4">No CPU stats found for this device.</div>;

  return (
    <div className={`signalRightElementContainer ${showData ? "expanded" : "collapsed"}`}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? "\u25CF" : "\u25CB"} CPU Utilization Statistics
        </h2>
      </div>

      {showData && (
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px" }}>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={cpuData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="timestamp" />
                <YAxis domain={[0, 100]} /> {/* Assume percentage values */}
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
        </div>
      )}
    </div>
  );
};

export default CpuUtilsStats;
