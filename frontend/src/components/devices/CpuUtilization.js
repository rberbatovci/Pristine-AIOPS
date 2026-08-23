import { useState, useEffect, useRef } from "react";

import {
    RadialBarChart,
    PolarAngleAxis,
    RadialBar,
    Cell,
    ResponsiveContainer
} from "recharts";
import {
    PiCpuDuotone
} from "react-icons/pi";
import '../../css/CpuUtilizationModern.css';
import useDeviceStatus from "../../hooks/useDeviceStatus";


function CpuUtilization({ selectedDevice, keycloak }) {
    const socketRef = useRef(null);
    const [cpuLoading, setCpuLoading] = useState(false);
    const [error, setError] = useState("");
    const [cpuTimestamp, setCpuTimestamp] = useState(null);
    const [cpuChartData, setCpuChartData] = useState([
        {
            name: "5m Avg",
            value: 0,
            key: "five-minutes"
        },
        {
            name: "1m Avg",
            value: 0,
            key: "one-minute"
        },
        {
            name: "5s Avg",
            value: 0,
            key: "five-seconds"
        }
    ]);

    const {
        data: initialCpu,
        loading: initialLoading,
        error: initialError
    } = useDeviceStatus(
        keycloak,
        selectedDevice,
        "cpu"
    );

    const handleCpuUpdate = (msg) => {
        if (!msg?.stats)
            return;
        const stats = msg.stats;
        setCpuChartData([
            {
                name: "5m Avg",
                value: Math.min(
                    Number(stats["five-minutes"] ?? 0),
                    100
                ),
                key: "five-minutes"
            },

            {
                name: "1m Avg",
                value: Math.min(
                    Number(stats["one-minute"] ?? 0),
                    100
                ),
                key: "one-minute"
            },

            {
                name: "5s Avg",
                value: Math.min(
                    Number(stats["five-seconds"] ?? 0),
                    100
                ),
                key: "five-seconds"
            }
        ]);
        setCpuTimestamp(
            msg.timestamp ?? null
        );
        setError("");
    };

    useEffect(() => {
        if (initialCpu) {
            handleCpuUpdate(initialCpu);
        }
    }, [initialCpu]);

    useEffect(() => {
        if (!selectedDevice?.hostname)
            return;

        const protocol =
            window.location.protocol === "https:"
                ? "wss"
                : "ws";
        const ws = new WebSocket(
            `${protocol}://${window.location.host}/ws/cpu?device=${selectedDevice.hostname}`
        );
        socketRef.current = ws;
        setCpuLoading(true);

        ws.onopen = () => {
            console.log(
                "🔌 CPU websocket connected"
            );
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(
                    event.data
                );
                if (msg.type === "cpu-util") {
                    handleCpuUpdate(msg);
                }
            }
            catch (err) {
                console.error(
                    "CPU websocket parse error",
                    err
                );
            }
            finally {
                setCpuLoading(false);
            }
        };
        ws.onerror = (err) => {
            console.error(
                "CPU websocket error",
                err
            );
            setError(
                "CPU websocket error"
            );
        };

        ws.onclose = () => {
            console.log(
                "❌ CPU websocket disconnected"
            );
        };
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [
        selectedDevice?.hostname
    ]);

    const getSeverityColor = (value) => {
        if (value >= 85)
            return "var(--color-critical)";
        if (value >= 65)
            return "var(--color-warning)";
        return "var(--color-healthy)";
    };

    const renderColor = (value) => {
        if (value >= 85)
            return "text-critical";
        if (value >= 65)
            return "text-warning";
        return "text-healthy";
    };

    return (
        <div
            className="cpu-monitor-card"
            style={{
                width: "calc(50% - 15px)"
            }}
        >
            <div className="info-header">
                <div className="header-title">
                    <PiCpuDuotone
                        style={{
                            fontSize: 18
                        }}
                    />
                    <h2>
                        CPU Utilization
                    </h2>
                </div>
            </div>
            <div className="cpu-monitor-content">
                <div className="chart-container">
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="45%"
                            outerRadius="100%"
                            barSize={8}
                            data={cpuChartData}
                            startAngle={90}
                            endAngle={-270}
                        >
                            <RadialBar
                                background={{
                                    fill: "var(--bg-track)"
                                }}
                                dataKey="value"
                                cornerRadius={4}
                            >
                                {
                                    cpuChartData.map(entry => (
                                        <Cell
                                            key={entry.key}
                                            fill={
                                                getSeverityColor(
                                                    entry.value
                                                )
                                            }
                                        />
                                    ))
                                }
                            </RadialBar>
                            <PolarAngleAxis
                                type="number"
                                domain={[0, 100]}
                                tick={false}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                    <button
                        className={
                            `center-action-btn ${cpuLoading || initialLoading
                                ? "is-loading"
                                : ""
                            }`
                        }
                        title="Live CPU Stream"
                    >
                        <PiCpuDuotone />
                    </button>
                </div>
                <div className="metrics-sidebar">
                    {
                        (error || initialError) &&
                        <div className="metrics-error-banner">
                            {
                                error ||
                                initialError?.message
                            }
                        </div>
                    }
                    <div className="telemetry-rows">
                        {
                            [...cpuChartData]
                                .reverse()
                                .map(stat => (
                                    <div
                                        className="metric-row"
                                        key={stat.key}
                                    >
                                        <div className="metric-meta">
                                            <span
                                                className={
                                                    `status-dot ${renderColor(
                                                        stat.value
                                                    )
                                                    }`
                                                }
                                            />
                                            <span className="metric-label">
                                                {stat.name}
                                            </span>
                                        </div>
                                        <div
                                            className={
                                                `metric-value ${renderColor(
                                                    stat.value
                                                )
                                                }`
                                            }
                                        >
                                            {stat.value}%
                                        </div>
                                    </div>
                                ))
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CpuUtilization;