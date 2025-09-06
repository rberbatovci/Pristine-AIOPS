import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { IoPushOutline, IoPushSharp, IoRefreshCircleSharp, IoRefreshCircleOutline } from "react-icons/io5";

function MemoryStatistics({ selectedDevice, onSuccess }) {
  const [device, setDevice] = useState(selectedDevice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalMemory, setTotalMemory] = useState(0);
  const [usedMemory, setUsedMemory] = useState(0);
  const [freeMemory, setFreeMemory] = useState(0);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTimestamp, setMemoryTimestamp] = useState(null);
  const [shouldSpin, setShouldSpin] = useState(true);
  const [memoryChartData, setMemoryChartData] = useState([
    { name: 'Used', value: 0, fill: '#0088FE', opacity: 0.9 },
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
    const stats = data.stats || {};   // <-- extract the nested stats object

    if (!data.error && Object.keys(stats).length > 0) {
      const used = Number(stats["used-memory"] || 0);
      const free = Number(stats["free-memory"] || 0);
      const total = Number(stats["total-memory"] || used + free);

      setTotalMemory(total);
      setUsedMemory(used);
      setFreeMemory(free);

      setMemoryChartData([
        { name: 'Used', value: used, fill: '#0088FE', opacity: 0.9 },
        { name: 'Free', value: free, fill: '#00C49F', opacity: 0.8 },
      ]);

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
        const used = Number(procMem["used-memory"]);
        const free = Number(procMem["free-memory"]);
        const total = Number(procMem["total-memory"]);

        setTotalMemory(total);
        setUsedMemory(used);
        setFreeMemory(free);

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

      {/* Memory Section */}
      <div>
        <PieChart
          width={150}
          height={150}
          className={shouldSpin ? "rotate-on-load" : ""}
        >
          <Pie
            data={memoryChartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="85%"
            cornerRadius={10}
            isAnimationActive={!shouldSpin}
            animationDuration={800}
          >
            {memoryChartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <RechartsTooltip />
        </PieChart>
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
        <div style={{ display: "flex", fontSize: "13px" }}>
          <p style={{ textAlign: "right", width: "50px", marginTop: "5px" }}>Time:</p>
          <p style={{ textAlign: "left", width: "100px", marginLeft: "5px", marginTop: "5px" }}>
            {memoryTimestamp
              ? new Date(memoryTimestamp).toLocaleString()
              : "Loading..."}
          </p>
        </div>
        <div style={{ display: "flex", fontSize: "13px" }}>
          <p style={{ textAlign: "right", width: "50px", marginTop: "5px" }}>Source:</p>
          <p style={{ textAlign: "left", width: "100px", marginLeft: "5px", marginTop: "5px" }}>
            {memoryTimestamp ? "Telemetry" : "Fetching..."}
          </p>
        </div>
        <div style={{ display: "flex", marginTop: "5px" }}>
          <button className="iconButton" onClick={getLastMemoryStatus}>
            <IoRefreshCircleOutline className="defaultIcon" />
            <IoRefreshCircleSharp className="hoverIcon" />
          </button>
          <button className="iconButton" onClick={getLiveMemoryStatus}>
            <IoPushOutline className="defaultIcon" />
            <IoPushSharp className="hoverIcon" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemoryStatistics;
