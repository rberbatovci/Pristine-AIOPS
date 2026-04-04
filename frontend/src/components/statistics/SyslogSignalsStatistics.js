import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Typography } from '@mui/material';
import kcFetch from '../misc/kcFetch.js';
import '../../css/SyslogDatabase.css';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";

function SyslogSignalsStatistics({ keycloak, selectedTags = [] }) {
    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});

    const colorPalette = [
        '#FF6347', '#32CD32', '#FFD700',
        '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'
    ];

    // Normalize selectedTags (handles string OR react-select object)
    const normalizeTags = (tags) => {
        const excluded = ["timestamp", "content"];

        return tags
            .map(tag => typeof tag === "string" ? tag : tag?.value)
            .filter(tag => tag && !excluded.includes(tag.toLowerCase()));
    };

    const normalizedTags = normalizeTags(selectedTags);

    useEffect(() => {
        if (!normalizedTags.length) return;

        const fetchStatistics = async (dataType) => {
            setLoadingMap(prev => ({ ...prev, [dataType]: true }));

            let endpoint;
            switch (dataType) {
                case "device":
                    endpoint = "/signals/syslogs/statistics/devices";
                    break;
                case "mnemonic":
                    endpoint = "/signals/syslogs/statistics/mnemonics";
                    break;
                case "status":
                    endpoint = "/signals/syslogs/statistics/status";
                    break;
                case "rules":
                    endpoint = "/signals/syslogs/statistics/rules";
                    break;
                case "severity":
                    endpoint = "/signals/syslogs/statistics/severity";
                    break;
                default:
                    endpoint = `/signals/syslogs/statistics/affected-entities/${dataType}`;
            }

            try {
                const data = await kcFetch(keycloak, endpoint);

                let processedData = [];

                if (Array.isArray(data?.statistics)) {
                    processedData = data.statistics.map(item => ({
                        name: item.value || item.name || "N/A",
                        value: item.count ?? 0,
                    }));
                } else if (typeof data === "object" && data !== null) {
                    processedData = Object.entries(data).map(
                        ([key, value]) => ({
                            name: key,
                            value: Number(value) || 0
                        })
                    );
                }

                setChartDataMap(prev => ({
                    ...prev,
                    [dataType]: processedData,
                }));
            } catch (error) {
                console.error(`Error fetching data for ${dataType}:`, error);
                setChartDataMap(prev => ({
                    ...prev,
                    [dataType]: [],
                }));
            } finally {
                setLoadingMap(prev => ({
                    ...prev,
                    [dataType]: false,
                }));
            }
        };

        // Fetch new tags only
        normalizedTags.forEach(tag => {
            if (!chartDataMap[tag] && !loadingMap[tag]) {
                fetchStatistics(tag);
            }
        });

        // Cleanup removed tags safely
        setChartDataMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!normalizedTags.includes(key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

        setLoadingMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!normalizedTags.includes(key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

    }, [normalizedTags, keycloak]);

    const handleChartTypeChange = (dataType, type) => {
        setChartTypeMap(prev => ({ ...prev, [dataType]: type }));
    };

    const renderTooltip = ({ payload }) => {
        if (payload && payload.length) {
            const { name, value } = payload[0].payload;
            return (
                <div style={{
                    backgroundColor: '#fff',
                    padding: '6px',
                    border: '1px solid #ccc'
                }}>
                    <strong>{name}</strong>
                    <p>Count: {value}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-around'
            }}>
                {normalizedTags.map(dataType => {
                    const chartType = chartTypeMap[dataType] || 'BarChart';
                    const chartData = chartDataMap[dataType] || [];
                    const isLoading = loadingMap[dataType];

                    return (
                        <div
                            key={dataType}
                            className="signalRightElementContainer"
                            style={{ width: '540px', height: '380px' }}
                        >
                            {/* Header */}
                            <div
                                className="signalRightElementHeader"
                                style={{ marginBottom: '20px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <h2 style={{
                                        fontSize: '15px',
                                        marginLeft: '20px',
                                        fontWeight: 'bold',
                                        color: 'var(--textColor)'
                                    }}>
                                        {dataType.charAt(0).toUpperCase() + dataType.slice(1)}
                                    </h2>
                                    <span style={{
                                        fontSize: '14px',
                                        marginLeft: '5px',
                                        color: 'var(--textColor)'
                                    }}>
                                        - Signal Statistics
                                    </span>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'center',
                                    marginRight: '10px'
                                }}>
                                    {chartType !== 'PieChart' && (
                                        <AiOutlinePieChart
                                            size={24}
                                            onClick={() =>
                                                handleChartTypeChange(dataType, 'PieChart')
                                            }
                                            style={{ cursor: 'pointer', color: '#999' }}
                                            title="Pie Chart"
                                        />
                                    )}
                                    {chartType !== 'BarChart' && (
                                        <IoBarChartOutline
                                            size={24}
                                            onClick={() =>
                                                handleChartTypeChange(dataType, 'BarChart')
                                            }
                                            style={{ cursor: 'pointer', color: '#999' }}
                                            title="Bar Chart"
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Loading */}
                            {isLoading && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '100%'
                                }}>
                                    <Typography>Loading...</Typography>
                                </div>
                            )}

                            {/* No Data */}
                            {!isLoading && chartData.length === 0 && (
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    height: '100%'
                                }}>
                                    <Typography color="textSecondary">
                                        No data available for {dataType}
                                    </Typography>
                                </div>
                            )}

                            {/* Pie Chart */}
                            {!isLoading && chartData.length > 0 && chartType === 'PieChart' && (
                                <PieChart width={480} height={300}>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={colorPalette[index % colorPalette.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={renderTooltip} />
                                </PieChart>
                            )}

                            {/* Bar Chart */}
                            {!isLoading && chartData.length > 0 && chartType === 'BarChart' && (
                                <BarChart width={480} height={300} data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip content={renderTooltip} />
                                    <Bar dataKey="value">
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={colorPalette[index % colorPalette.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default SyslogSignalsStatistics;