import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

function MemoryStatistics({ selectedDevice, onSuccess }) {
    const [device, setDevice] = useState(selectedDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [totalMemory, setTotalMemory] = useState(0); 
    const [usedMemory, setUsedMemory] = useState(0); 
    const [freeMemory, setFreeMemory] = useState(0); 
    const [memoryLoading, setMemoryLoading] = useState(false); 
    const [memoryTimestamp, setMemoryTimestamp] = useState(null);
    
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
                setTotalMemory(Number(procMem["total-memory"]));
                setUsedMemory(Number(procMem["used-memory"]));
                setFreeMemory(Number(procMem["free-memory"]));
                setMemoryTimestamp(new Date().toISOString());
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

    const memoryChartData = [
        { name: 'Used', value: usedMemory },
        { name: 'Free', value: freeMemory },
    ];

    useEffect(() => {
        if (device?.hostname) {
            getLastMemoryStatus();
            getMemoryStatus();
        }
    }, [device]);

    const colorPalette = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Memory Section */}
        <div>
            <PieChart width={150} height={150}>
              <Pie
                data={memoryChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label
              >
                {memoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
              <Legend />
            </PieChart>
        </div>
        <div style={{ fontSize: "14px", color: "var(--textColor)", opacity: 0.9, width: "200px" }}>
          <div><b>Memory statistics</b></div>
          <div style={{ display: "flex", fontSize: "13px" }}>
            <p style={{ textAlign: "right", width: "100px" }}>Time:</p>
            <p style={{ textAlign: "left", width: "100px" }}>
              {memoryTimestamp ? new Date(memoryTimestamp).toLocaleString() : "N/A"}
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

export default MemoryStatistics;
