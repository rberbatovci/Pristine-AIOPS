import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { Typography } from '@mui/material';
import kcFetch from '../misc/kcFetch.js';
import '../../css/SyslogDatabase.css';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";

function TrapSignalsStatistics({ keycloak, selectedTags = [] }) {
    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});

    const colorPalette = [
        '#FF6347', '#32CD32', '#FFD700',
        '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'
    ];

    // Fetch data when selectedTags change
    useEffect(() => {
        if (!selectedTags || selectedTags.length === 0) return;

        const selectedValues = selectedTags.map(option => option.value);

        selectedTags.forEach(async (option) => {
            const dataType = option.value;

            if (!chartDataMap[dataType] && !loadingMap[dataType]) {
                setLoadingMap(prev => ({ ...prev, [dataType]: true }));

                let endpoint;
                switch (dataType) {
                    case "device":
                        endpoint = "/signals/traps/statistics/devices";
                        break;
                    case "mnemonic":
                        endpoint = "/signals/traps/statistics/mnemonics";
                        break;
                    case "status":
                        endpoint = "/signals/traps/statistics/status";
                        break;
                    case "rules":
                        endpoint = "/signals/traps/statistics/rules";
                        break;
                    case "severity":
                        endpoint = "/signals/traps/statistics/severity";
                        break;
                    default:
                        endpoint = `/signals/traps/statistics/affected-entities/${dataType}`;
                }

                try {
                    const data = await kcFetch(keycloak, endpoint);

                    let processedData = [];

                    if (Array.isArray(data.statistics)) {
                        processedData = data.statistics.map(item => ({
                            name: item.value || item.name || "N/A",
                            value: item.count ?? 0,
                        }));
                    } else if (typeof data === "object" && data !== null) {
                        processedData = Object.entries(data).map(
                            ([key, value]) => ({
                                name: key,
                                value: value
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
            }
        });

        // Cleanup removed chart data
        setChartDataMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!selectedValues.includes(key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

        setLoadingMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!selectedValues.includes(key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

    }, [selectedTags]);

    const handleChartTypeChange = (dataType, type) => {
        setChartTypeMap(prev => ({
            ...prev,
            [dataType]: type
        }));
    };

    const renderPieTooltip = ({ payload }) => {
        if (payload && payload.length) {
            const { name, value } = payload[0].payload;
            return (
                <div style={{
                    backgroundColor: '#fff',
                    padding: '5px',
                    border: '1px solid #ccc'
                }}>
                    <strong>{name}</strong>
                    <p>{`Count: ${value}`}</p>
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
                {selectedTags.map(option => {
                    const dataType = option.value;
                    const chartType = chartTypeMap[dataType] || 'BarChart';
                    const chartData = chartDataMap[dataType] || [];
                    const isLoading = loadingMap[dataType];

                    return (
                        <div
                            key={dataType}
                            className="signalRightElementContainer"
                            style={{ width: '540px', height: '380px' }}
                        >
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
                                        {option.label}
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

                            {isLoading && <Typography>Loading...</Typography>}

                            {!isLoading && chartData.length === 0 && (
                                <Typography>
                                    No data available for {option.label}
                                </Typography>
                            )}

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
                                        label
                                    >
                                        {chartData.map((_, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={colorPalette[index % colorPalette.length]}
                                            />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={renderPieTooltip} />
                                    <Legend />
                                </PieChart>
                            )}

                            {!isLoading && chartData.length > 0 && chartType === 'BarChart' && (
                                <BarChart width={480} height={300} data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip content={renderPieTooltip} />
                                    <Legend />
                                    <Bar dataKey="value">
                                        {chartData.map((_, index) => (
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

export default TrapSignalsStatistics;