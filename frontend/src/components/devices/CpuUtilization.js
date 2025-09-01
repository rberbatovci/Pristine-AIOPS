import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

function CpuUtilization({ selectedDevice, onSuccess }) {
    const [device, setDevice] = useState(selectedDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cpuLoading, setCpuLoading] = useState(false);
    const [cpuTimestamp, setCpuTimestamp] = useState(null);
    const [cpu5s, setCpu5s] = useState(0);
    const [cpu1m, setCpu1m] = useState(0);
    const [cpu5m, setCpu5m] = useState(0);
    const [cpuChartData, setCpuChartData] = useState([
        { name: '5s Avg', value: 0, fill: 'green', opacity: 0.7 },
        { name: '1m Avg', value: 0, fill: 'purple', opacity: 0.5 },
        { name: '5m Avg', value: 0, fill: 'aqua', opacity: 0.3 },
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

    // Last stats from OpenSearch
    const getLastCpuStatus = async () => {
        setCpuLoading(true); setError('');
        try {
            const response = await apiClient.get("/telemetry/cpu-utilization/", {
                params: { device: device.hostname, limit: 1 }
            });
            const last = response.data.results?.[0];

            if (last) {
                setCpu5s(last.cpu_5s || 0);
                setCpu1m(last.cpu_1m || 0);
                setCpu5m(last.cpu_5m || 0);
                setCpuTimestamp(last.timestamp || null);
            }
            if (last) {
                const newData = [
                    { name: '5s Avg', value: Math.min(last.cpu_5s, 100), fill: 'black', opacity: 0.5 },
                    { name: '1m Avg', value: Math.min(last.cpu_1m, 100), fill: 'black', opacity: 0.4 },
                    { name: '5m Avg', value: Math.min(last.cpu_5m, 100), fill: 'black', opacity: 0.3 },
                ];
                setCpuChartData(newData);
                setCpuTimestamp(new Date().toISOString());
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setCpuLoading(false); }
    };

    // Add this CSS somewhere (App.css or module.css)
    const rotatingRingStyle = {
        width: "150px",
        height: "150px",
        border: "6px solid rgba(0,0,0,0.1)",
        borderTop: "6px solid #4cafef",
        borderRadius: "50%",
        animation: "spin 1s linear infinite",
        margin: "auto"
    };

    const getCpuStatus = async () => {
        setCpuLoading(true); setError('');
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/status/live/cpu/`);
            const cpu = response.data.cpu?.["Cisco-IOS-XE-process-cpu-oper:cpu-utilization"];
            if (cpu) {
                const newData = [
                    { name: '5s Avg', value: Math.min(cpu["five-seconds"], 100), fill: 'black', opacity: 0.5 },
                    { name: '1m Avg', value: Math.min(cpu["one-minute"], 100), fill: 'black', opacity: 0.4 },
                    { name: '5m Avg', value: Math.min(cpu["five-minutes"], 100), fill: 'black', opacity: 0.3 },
                ];
                setCpuChartData(newData);
                setCpuTimestamp(new Date().toISOString());
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setCpuLoading(false); }
    };

    const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 rounded-lg shadow-lg bg-gray-900 text-white">
        <p className="text-sm font-semibold">{label}</p>
        {payload.map((item, i) => (
          <p key={i} className="text-xs" style={{ color: item.fill }}>
            {item.name}: {item.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

    useEffect(() => {
        if (device?.hostname) {
            getLastCpuStatus();
            getCpuStatus();
        }
    }, [device]);

return (
  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
    {/* CPU Section */}
    <div>
      {cpuLoading ? (
        // ✅ Rotating ring effect
        <div style={rotatingRingStyle}></div>
      ) : (
        // ✅ Normal animated RadialBarChart once data arrives
        <RadialBarChart
          width={150}
          height={150}
          cx="50%"
          cy="50%"
          innerRadius="20%"
          outerRadius="100%"
          barSize={15}
          data={cpuChartData}
        >
          <RadialBar
            minAngle={5}
            clockWise
            dataKey="value"
            cornerRadius={10}
            isAnimationActive={true}
            animationDuration={800}
          >
            {cpuChartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.fill}
                fillOpacity={entry.opacity}
              />
            ))}
          </RadialBar>
          <RechartsTooltip content={<CustomTooltip />} />
        </RadialBarChart>
      )}
    </div>

    {/* Info Section */}
    <div
      style={{
        fontSize: "14px",
        color: "var(--textColor)",
        opacity: 0.9,
        width: "200px"
      }}
    >
      <div><b>CPU Utilization</b></div>
      <div style={{ display: "flex", fontSize: "13px" }}>
        <p style={{ textAlign: "right", width: "100px" }}>Time:</p>
        <p style={{ textAlign: "left", width: "100px" }}>
          {cpuTimestamp ? new Date(cpuTimestamp).toLocaleString() : "N/A"}
        </p>
      </div>
      <div style={{ display: "flex", fontSize: "13px" }}>
        <p style={{ textAlign: "right", width: "100px" }}>Source:</p>
        <p style={{ textAlign: "left", width: "100px" }}>Telemetry</p>
      </div>
      <button className="telemetryButton">Configure Telemetry</button>
    </div>
  </div>
);
}

export default CpuUtilization;
