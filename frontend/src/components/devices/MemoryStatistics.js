import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { RadialBarChart, PolarAngleAxis, RadialBar, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { IoPushOutline, IoPushSharp, IoRefreshCircleSharp, IoRefreshCircleOutline } from "react-icons/io5";

function MemoryStatistics({ selectedDevice, onSuccess }) {
  const [device, setDevice] = useState(selectedDevice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTimestamp, setMemoryTimestamp] = useState(null);
  const [shouldSpin, setShouldSpin] = useState(true);
  const [memoryChartData, setMemoryChartData] = useState([
    { name: 'Processor', value: 0, fill: '#0088FE', opacity: 0.9 },
    { name: 'Free', value: 0, fill: '#00C49F', opacity: 0.8 },
  ]);

  // ✅ Sync state when selectedDevice changes
  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  const sendConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.post(`/devices/${device.hostname}/config/syslogs/`, {});
      setDevice(prev => ({
        ...prev,
        features: { ...prev.features, syslogs: true },
      }));
      if (onSuccess) onSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Fetch last memory stats from Redis
  const getLastMemoryStatus = async () => {
    setMemoryLoading(true);
    setError('');
    try {
      const response = await apiClient.get(
        `/devices/${device.hostname}/status/last/memory-stats/`
      );

      const data = response.data || {};

      if (!data.error && Object.keys(data).length > 0) {

        const newData = [
          { name: 'Processor', value: data["Processor"], fill: 'green', opacity: 1 },
          { name: 'Reserve Processor', value: data["reserve Processor"], fill: 'green', opacity: 0.9 },
          { name: 'lsmpi_io', value: data["lsmpi_io"], fill: 'green', opacity: 0.8 },
        ];

        setMemoryChartData(newData);

        // ✅ Prefer backend timestamp (msg_timestamp) if available
        if (data.msg_timestamp) {
          setMemoryTimestamp(
            new Date(data.msg_timestamp).toISOString()  // <-- already ms, no need /1000
          );
        } else {
          setMemoryTimestamp(null);
        }

        setShouldSpin(false);
      } else {
        setError(data.error || "No memory data available");
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unknown error');
    } finally {
      setMemoryLoading(false);
    }
  };

  // 🔹 Fetch live memory stats via RESTCONF
  const getLiveMemoryStatus = async () => {
    setMemoryLoading(true);
    setError('');
    try {
      const response = await apiClient.get(`/devices/${device.hostname}/status/live/memory/`);
      const stats = response.data.memory?.["Cisco-IOS-XE-memory-oper:memory-statistic"] || [];
      const procMem = stats.find(m => m.name === "Processor");

      if (procMem) {
        const used = Number(procMem["Processor"]);
        const free = Number(procMem["reserve Processor"]);
        const total = Number(procMem["lsmpi_io"]);

        setMemoryChartData([
          { name: 'Used', value: used, fill: '#0088FE', opacity: 0.9 },
          { name: 'Free', value: free, fill: '#00C49F', opacity: 0.8 },
        ]);

        setMemoryTimestamp(new Date().toISOString()); // live data = now
        setShouldSpin(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unknown error');
    } finally {
      setMemoryLoading(false);
    }
  };

  useEffect(() => {
    if (device?.hostname) {
      getLastMemoryStatus();
    }
  }, [device]);

  const rotatingChartStyle = `
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .rotate-on-load {
      animation: rotate 2s linear infinite;
    }
  `;

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
      {/* inject spin CSS */}
      <style>{rotatingChartStyle}</style>

      {/* CPU Section */}
      <div style={{ position: "relative", width: "150px", height: "150px" }}>
        <RadialBarChart
          width={150}
          height={150}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="100%"
          barSize={15}
          data={memoryChartData}
          className={shouldSpin ? 'rotate-on-load' : ''}
        >
          <RadialBar
            minAngle={5}
            clockWise
            dataKey="value"
            cornerRadius={10}
            isAnimationActive={!shouldSpin}
            animationDuration={800}
            background={{ fill: "#eee", opacity: 0.1 }}
          >
            {memoryChartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.fill}
                fillOpacity={entry.opacity}
              />
            ))}
          </RadialBar>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        </RadialBarChart>

        {/* ✅ Center Circle Button */}
        <button
          onClick={getLiveMemoryStatus}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "50px",
            height: "50px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "#00C49F",
            color: "white",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px"
          }}
        >
        </button>
      </div>

      {/* Info Section */}
      <div
        style={{
          fontSize: "14px",
          color: "var(--textColor)",
          opacity: 0.9,
          width: "200px",
        }}
      >
        <div>
          <b>Memory statistics</b>
        </div>
        <div style={{ display: "flex" }}>
          <p style={{ marginTop: "5px" }}>Main: {memoryChartData[0]?.value ?? "--"}%</p>
          <p style={{ marginTop: "5px", marginLeft: "10px" }}>Res: {memoryChartData[1]?.value ?? "--"}%</p>
          <p style={{ marginTop: "5px", marginLeft: "10px" }}>LSMP: {memoryChartData[2]?.value ?? "--"}%</p>
        </div>
        <div style={{ display: "flex", fontSize: "13px" }}>
          <p style={{ textAlign: "right", width: "50px", marginTop: "5px" }}>Time:</p>
          <p style={{ textAlign: "left", width: "100px", marginLeft: "5px", marginTop: "5px" }}>
            {memoryTimestamp
              ? new Date(memoryTimestamp).toLocaleString()
              : "Loading..."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MemoryStatistics;
