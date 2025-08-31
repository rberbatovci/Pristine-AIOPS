import { useState, useEffect } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";
import { RadialBarChart, RadialBar, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';

function SystemUtilization({ selectedDevice, onSuccess }) {
    const [device, setDevice] = useState(selectedDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // CPU
    const [cpu5s, setCpu5s] = useState(0);
    const [cpu1m, setCpu1m] = useState(0);
    const [cpu5m, setCpu5m] = useState(0);
    const [cpuLoading, setCpuLoading] = useState(false);
    const [cpuTimestamp, setCpuTimestamp] = useState(null);

    // Memory
    const [totalMemory, setTotalMemory] = useState(0);
    const [usedMemory, setUsedMemory] = useState(0);
    const [freeMemory, setFreeMemory] = useState(0);
    const [memoryLoading, setMemoryLoading] = useState(false);
    const [memoryTimestamp, setMemoryTimestamp] = useState(null);

    const colorPalette = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    useEffect(() => setDevice(selectedDevice), [selectedDevice]);

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

    const getCpuStatus = async () => {
        setCpuLoading(true); setError('');
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/status/cpu/`);
            const cpu = response.data.cpu?.["Cisco-IOS-XE-process-cpu-oper:cpu-utilization"];
            if (cpu) {
                setCpu5s(cpu["five-seconds"]);
                setCpu1m(cpu["one-minute"]);
                setCpu5m(cpu["five-minutes"]);
                setCpuTimestamp(new Date().toISOString());
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setCpuLoading(false); }
    };

    const getMemoryStatus = async () => {
        setMemoryLoading(true); setError('');
        try {
            const response = await apiClient.get(`/devices/${device.hostname}/status/memory/`);
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
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setCpuLoading(false); }
    };

    const getLastMemoryStatus = async () => {
        setMemoryLoading(true); setError('');
        try {
            const response = await apiClient.get("/telemetry/memory-statistics/", {
                params: { device: device.hostname, limit: 1 }
            });
            const last = response.data.results?.[0];
            if (last) {
                setTotalMemory(Number(last.total_memory || 0));
                setUsedMemory(Number(last.used_memory || 0));
                setFreeMemory(Number(last.free_memory || 0));
                setMemoryTimestamp(last.timestamp || null);
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally { setMemoryLoading(false); }
    };

    useEffect(() => {
        if (device?.hostname) {
            getLastCpuStatus();
            getLastMemoryStatus();
            getCpuStatus();
            getMemoryStatus();
        }
    }, [device]);

    const cpuChartData = [
        { name: '5s Avg', value: cpu5s },
        { name: '1m Avg', value: cpu1m },
        { name: '5m Avg', value: cpu5m },
    ];

    const memoryChartData = [
        { name: 'Used', value: usedMemory },
        { name: 'Free', value: freeMemory },
    ];

    const cpuRadialData = [
        { name: '5s Avg', value: cpu5s, remaining: 100 - cpu5s, fill: '#0088FE' },
        { name: '1m Avg', value: cpu1m, remaining: 100 - cpu1m, fill: '#00C49F' },
        { name: '5m Avg', value: cpu5m, remaining: 100 - cpu5m, fill: '#FFBB28' },
    ];

    return (
        <div className="signalRightElementContainer" style={{ maxHeight: '450px' }}>
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt">System Utilization</h2>
                {!device?.features?.syslogs && (
                    <div className="zoom-buttons-container">
                        <div className="headerButtons">
                            {loading ? (
                                <TailSpin height="20" width="20" color="#ffffff" ariaLabel="loading" />
                            ) : (
                                <button className="iconButton" onClick={sendConfig}>
                                    <IoPushOutline className="defaultIcon" />
                                    <IoPushSharp className="hoverIcon" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CPU Section */}
            <div style={{ display: 'flex', gap: '20px', padding: '12px', alignItems: 'center' }}>
                <div>
                    {cpuLoading ? <TailSpin height="30" width="30" color="#8884d8" /> : (
                        <RadialBarChart
                            width={300}
                            height={300}
                            cx="50%"
                            cy="50%"
                            innerRadius={20}
                            outerRadius={120}
                            barSize={10}
                        >
                            {/* 5s Avg */}
                            <RadialBar
                                data={[{ name: '5s Avg', value: cpu5s }]}
                                dataKey="value"
                                background={{ fill: '#eee' }}
                                clockWise
                                cornerRadius={5}
                                fill="#0088FE"
                                minAngle={15}
                                outerRadius="100%"
                                innerRadius="80%"
                            />

                            {/* 1m Avg */}
                            <RadialBar
                                data={[{ name: '1m Avg', value: cpu1m }]}
                                dataKey="value"
                                background={{ fill: '#eee' }}
                                clockWise
                                cornerRadius={5}
                                fill="#00C49F"
                                minAngle={15}
                                outerRadius="70%"
                                innerRadius="60%"
                            />

                            {/* 5m Avg */}
                            <RadialBar
                                data={[{ name: '5m Avg', value: cpu5m }]}
                                dataKey="value"
                                background={{ fill: '#eee' }}
                                clockWise
                                cornerRadius={5}
                                fill="#FFBB28"
                                minAngle={15}
                                outerRadius="50%"
                                innerRadius="40%"
                            />

                            <Legend />
                            <RechartsTooltip />
                        </RadialBarChart>
                    )}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--textColor)', opacity: 0.9 }}>
                    <h3>CPU Utilization</h3>
                    <p><b>Last update:</b> {cpuTimestamp ? new Date(cpuTimestamp).toLocaleString() : "N/A"}</p>
                    <p><b>Path:</b> <code>Cisco-IOS-XE-process-cpu-oper:cpu-utilization</code></p>
                    <p><b>Interval:</b> 30s</p>
                    <button className="telemetryButton">Configure Telemetry</button>
                </div>
            </div>

            {/* Memory Section */}
            <div style={{ display: 'flex', gap: '20px', padding: '12px', alignItems: 'center' }}>
                <div>
                    {memoryLoading ? <TailSpin height="30" width="30" color="#00C49F" /> : (
                        <PieChart width={200} height={200}>
                            <Pie data={memoryChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {memoryChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                                ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                        </PieChart>
                    )}
                </div>
                <div style={{ fontSize: '14px', color: 'var(--textColor)', opacity: 0.9 }}>
                    <h3>Memory Statistics</h3>
                    <p><b>Last update:</b> {memoryTimestamp ? new Date(memoryTimestamp).toLocaleString() : "N/A"}</p>
                    <p><b>Path:</b> <code>Cisco-IOS-XE-memory-oper:memory-statistic</code></p>
                    <p><b>Interval:</b> 30s</p>
                    <button className="telemetryButton">Configure Telemetry</button>
                </div>
            </div>

            {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
        </div>
    );
}

export default SystemUtilization;
