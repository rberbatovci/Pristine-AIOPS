import { useState, useEffect } from 'react';
import kcFetch from '../misc/kcFetch';
import { RadialBarChart, PolarAngleAxis, RadialBar, Cell } from 'recharts';  

function CpuUtilization({ keycloak, selectedDevice, onSuccess, showNotification }) {
  const [device, setDevice] = useState(selectedDevice);
  const [error, setError] = useState('');
  const [cpuLoading, setCpuLoading] = useState(false);
  const [cpuTimestamp, setCpuTimestamp] = useState(null);
  const [shouldSpin, setShouldSpin] = useState(true);

  const [cpuChartData, setCpuChartData] = useState([
    { name: '5m Avg', value: 60, fill: '#ababab', opacity: 0.4 },
    { name: '1m Avg', value: 40, fill: '#ababab', opacity: 0.5 },
    { name: '5s Avg', value: 20, fill: '#ababab', opacity: 0.6 },
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
      const response = await kcFetch(keycloak, `/devices/status/${device.hostname}/cpu-util/`);
      if (response && response.stats && Object.keys(response.stats).length > 0) {
        const stats = response.stats;
        const newData = [
          { name: '5m Avg', value: Math.min(stats["five-minutes"] ?? 0, 100), fill: 'green', opacity: 0.8 },
          { name: '5s Avg', value: Math.min(stats["five-seconds"] ?? 0, 100), fill: 'green', opacity: 1 },
          { name: '1m Avg', value: Math.min(stats["one-minute"] ?? 0, 100), fill: 'green', opacity: 0.9 },
        ];
        setCpuChartData(newData);
        if (response.msg_timestamp) {
          setCpuTimestamp(new Date(response.msg_timestamp).toISOString());
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

    const getLiveCPUStatus = async () => {
    setCpuLoading(true);
    setError('');
    try {
      const response = await kcFetch(keycloak, `/devices/${device.hostname}/status/live/memory/`);
      const stats = response.data.memory?.["Cisco-IOS-XE-memory-oper:memory-statistic"] || [];
      const procMem = stats.find(m => m.name === "Processor");

      if (procMem) {
        const newData = [
          { name: '5m Avg', value: Math.min(stats["five-minutes"] ?? 0, 100), fill: 'green', opacity: 0.8 },
          { name: '5s Avg', value: Math.min(stats["five-seconds"] ?? 0, 100), fill: 'green', opacity: 1 },
          { name: '1m Avg', value: Math.min(stats["one-minute"] ?? 0, 100), fill: 'green', opacity: 0.9 },
        ];
        setCpuChartData(newData);
        setCpuTimestamp(new Date().toISOString());
        setShouldSpin(false);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unknown error');
    } finally {
      setCpuLoading(false);
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
      <div style={{ position: "relative", width: "150px", height: "150px" }}>
        <RadialBarChart
          width={150}
          height={150}
          cx="50%"
          cy="50%"
          innerRadius="50%"
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
            isAnimationActive={!shouldSpin}
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
            domain={[0, 100]}
            tick={false}
          />
        </RadialBarChart>
                <button
          onClick={getLiveCPUStatus}
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
        </div></>
      )}
    </div>
  );
}

export default CpuUtilization;
