import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';
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
      { name: 'used-memory', value: 40, fill: 'green', opacity: 0.9 },
      { name: 'free-memory', value: 60, fill: 'green', opacity: 0.8 },
    ]);

    // ✅ Sync state when selectedDevice changes
    useEffect(() => {
        setDevice(selectedDevice);
    }, [selectedDevice]);

    const sendConfig = async () => {
        setLoading(true); setError('');
        try {
            const response = await apiClient.post(`/devices/${device.hostname}/config/syslogs/`, {});
            setDevice(prev => ({ ...prev, features: { ...prev.features, syslogs: true } }));
            if (onSuccess) onSuccess(response.data);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setLoading(false); }
    };

        const getMemoryStatus = async () => {
        setMemoryLoading(true); setError('');
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/status/live/memory/`);
            const stats = response.data.memory?.["Cisco-IOS-XE-memory-oper:memory-statistic"] || [];
            const procMem = stats.find(m => m.name === "Processor");
            if (procMem) {
              const newData = [
                { name: 'Used', value: Math.min(stats["used-memory"] ?? 0, 100), fill: 'green', opacity: 0.9 },
                { name: 'Free', value: Math.min(stats["free-memory"] ?? 0, 100), fill: 'green', opacity: 0.8 },
              ];

              setTotalMemory(Number(procMem["total-memory"]));
              setUsedMemory(Number(procMem["used-memory"]));
              setFreeMemory(Number(procMem["free-memory"]));
              setMemoryTimestamp(new Date().toISOString());
              setShouldSpin(false);
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setMemoryLoading(false); }
    };

    const getLastMemoryStatus = async () => {
        setMemoryLoading(true); setError('');
        try {
            const response = await apiClient.get("/telemetry/memory-statistics/", {
                params: { device: device.hostname, limit: 1 }
            });
            const last = response.data.results?.[0];
            if (last) {
                setTotalMemory(Number(last.total_memory || 10));
                setUsedMemory(Number(last.used_memory || 10));
                setFreeMemory(Number(last.free_memory || 10));
                setMemoryTimestamp(last.timestamp || null);
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setMemoryLoading(false); }
    };

    useEffect(() => {
        if (device?.hostname) {
            getLastMemoryStatus();
            getMemoryStatus();
        }
    }, [device]);

    const colorPalette = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

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
            isAnimationActive={!shouldSpin} // animate after spin stops
            animationDuration={800}
          >
            {memoryChartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill}
              />
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
          <p style={{ textAlign: "left", width: "100px", marginLeft: "5px", marginTop: "5px" }}>Telemetry</p>
        </div>
        <div style={{ display: "flex", marginTop: "5px"}}>
          <button className="iconButton">
            <IoRefreshCircleOutline className="defaultIcon" />
            <IoRefreshCircleSharp className="hoverIcon" />
          </button>
          <button className="iconButton">
            <IoPushOutline className="defaultIcon" />
            <IoPushSharp className="hoverIcon" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemoryStatistics;
