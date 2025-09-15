import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { RadialBarChart, PolarAngleAxis, RadialBar, Cell, Tooltip as RechartsTooltip } from 'recharts';
import { IoPushOutline, IoPushSharp, IoRefreshCircleSharp, IoRefreshCircleOutline } from "react-icons/io5";

function CpuUtilization({ selectedDevice, onSuccess }) {
  const [device, setDevice] = useState(selectedDevice);
  const [error, setError] = useState('');
  const [cpuLoading, setCpuLoading] = useState(false);
  const [cpuTimestamp, setCpuTimestamp] = useState(null);
  const [shouldSpin, setShouldSpin] = useState(true);

  const [cpuChartData, setCpuChartData] = useState([
    { name: '5s Avg', value: 20, fill: '#ababab', opacity: 0.6 },
    { name: '1m Avg', value: 40, fill: '#ababab', opacity: 0.5 },
    { name: '5m Avg', value: 60, fill: '#ababab', opacity: 0.4 },
  ]);

  // keep device in sync
  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  const getLastCpuStatus = async () => {
    setCpuLoading(true);
    setError('');
    setShouldSpin(true);

    try {
      const response = await apiClient.get(`/devices/${device.hostname}/status/last/cpu-util/`);
      const data = response.data;

      if (data && data.stats && Object.keys(data.stats).length > 0) {
        const stats = data.stats;

        const newData = [
          { name: '5s Avg', value: Math.min(stats["five-seconds"] ?? 0, 100), fill: 'green', opacity: 1 },
          { name: '1m Avg', value: Math.min(stats["one-minute"] ?? 0, 100), fill: 'green', opacity: 0.9 },
          { name: '5m Avg', value: Math.min(stats["five-minutes"] ?? 0, 100), fill: 'green', opacity: 0.8 },
        ];

        setCpuChartData(newData);

        // Only set timestamp if backend provides it
        if (data.msg_timestamp) {
          setCpuTimestamp(new Date(data.msg_timestamp).toISOString());
        } else {
          setCpuTimestamp(null);
        }

        setShouldSpin(false);
      } else {
        setError('No data available');
        setCpuTimestamp(null);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unknown error');
      setCpuTimestamp(null);
    } finally {
      setCpuLoading(false);
    }
  };

  const pushConfiguration = () => async () => {
    if (!selectedDevice?.hostname) {
      console.error("No device selected");
      return;
    }

    try {
      const response = await apiClient.post(
        `/devices/${selectedDevice.hostname}/configure/cpu_util/`,
        {} // empty body
      );

      const updatedDevice = response.data;
      console.log("Updated device:", updatedDevice);

      // Optionally update state
      // setSelectedDevice(updatedDevice);

    } catch (err) {
      console.error("Request error:", err);
      const message = err.response?.data?.detail || err.message || err;
      alert(`Error configuring CPU utilization: ${message}`);
    }
  };

  useEffect(() => {
    if (device?.hostname) {
      getLastCpuStatus();
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
      <div>
        <RadialBarChart
          width={150}
          height={150}
          cx="50%"
          cy="50%"
          innerRadius="40%"
          outerRadius="100%"
          barSize={15}
          data={cpuChartData}
          className={shouldSpin ? 'rotate-on-load' : ''}
        >
          <RadialBar
            minAngle={5}
            clockWise
            dataKey="value"
            cornerRadius={10}
            isAnimationActive={!shouldSpin} // animate bars only after spin stops
            animationDuration={800}
            background={{ fill: "#eee", opacity: 0.1 }}
          >
            {cpuChartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.fill}
                fillOpacity={entry.opacity}
              />
            ))}
          </RadialBar>
          <PolarAngleAxis
            type="number"
            domain={[0, 100]} // ✅ Fixes scaling so 4 → 4%, 8 → 8%
            tick={false}
          />
        </RadialBarChart>
      </div>
      {cpuLoading ? (
        <div style={{ fontSize: "16px", color: "var(--textColor)", opacity: 0.8 }}>
          Loading CPU data...
        </div>
      ) : (
        <><div
          style={{
            fontSize: "14px",
            color: "var(--textColor)",
            opacity: 0.9,
            width: "200px",
          }}
        >
          <div><b>CPU Utilization</b></div>
          <div style={{ display: "flex" }}>
            <p style={{ marginTop: "5px" }}>5s: {cpuChartData[0]?.value ?? "--"}%</p>
            <p style={{ marginTop: "5px", marginLeft: "10px" }}>1m: {cpuChartData[1]?.value ?? "--"}%</p>
            <p style={{ marginTop: "5px", marginLeft: "10px" }}>5m: {cpuChartData[2]?.value ?? "--"}%</p>
          </div>
          <div style={{ display: "flex", fontSize: "13px" }}>
            <p style={{ textAlign: "left", width: "100px", marginLeft: "5px", marginTop: "5px" }}>
              {cpuTimestamp ? "No Timestamp" : "Loading..."}
            </p>
          </div>
          <div style={{ display: "flex", marginTop: "5px" }}>
            <button className="iconButton">
              <IoRefreshCircleOutline className="defaultIcon" />
              <IoRefreshCircleSharp className="hoverIcon" />
            </button>
            <button className="iconButton"
              onClick={pushConfiguration()}>
              <IoPushOutline className="defaultIcon" />
              <IoPushSharp className="hoverIcon" />
            </button>
          </div>
        </div></>
      )}
      {/* Info Section */}

    </div>
  );
}

export default CpuUtilization;
