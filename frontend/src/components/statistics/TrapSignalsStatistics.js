import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
    Typography
} from '@mui/material';
import apiClient from '../misc/AxiosConfig.js';
import '../../css/SyslogDatabase.css';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";

function TrapSignalsStatistics({ selTrapSignalsTags }) {
    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});
    const colorPalette = ['#FF6347', '#32CD32', '#FFD700', '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'];
    const chartOptions = [
        { value: 'PieChart', label: 'Pie Chart' },
        { value: 'BarChart', label: 'Bar Chart' },
    ];

    // Fetch data when selTrapSignalsTags change
    useEffect(() => {
        selTrapSignalsTags.forEach(dataType => {
            if (!chartDataMap[dataType] && !loadingMap[dataType]) {
                setLoadingMap(prev => ({ ...prev, [dataType]: true }));

                let endpoint = '';
                if (dataType === 'device') {
                    endpoint = '/signals/traps/devices/statistics';
                } else if (dataType === 'mnemonic') {
                    endpoint = '/signals/traps/mnemonics/statistics';
                } else if (dataType === 'status') {
                    endpoint = '/signals/traps/status/statistics';
                } else if (dataType === 'rules') {
                    endpoint = '/signals/traps/rules/statistics';
                } else if (dataType === 'severity') {
                    endpoint = '/signals/traps/severity/statistics';
                } else {
                    endpoint = `/signals/traps/affected-entities/statistics/${dataType}`;
                }

                apiClient.get(endpoint)
                    .then(response => {
                        let processedData = [];
                        if (Array.isArray(response.data.statistics)) {
                            processedData = response.data.statistics.map(item => ({
                                name: item.value || item.name || 'N/A',
                                value: item.count || 0,
                            }));
                        } else if (typeof response.data === 'object') {
                            processedData = Object.entries(response.data).map(
                                ([key, value]) => ({ name: key, value: value })
                            );
                        } else {
                            console.warn(`Unrecognized data format for ${dataType}`);
                        }

                        setChartDataMap(prev => ({ ...prev, [dataType]: processedData }));
                        setLoadingMap(prev => ({ ...prev, [dataType]: false }));
                    })
                    .catch(error => {
                        console.error(`Error fetching data for ${dataType}:`, error);
                        setChartDataMap(prev => ({ ...prev, [dataType]: [] }));
                        setLoadingMap(prev => ({ ...prev, [dataType]: false }));
                    });
            }
        });

        // Clean up removed types
        Object.keys(chartDataMap).forEach(dataType => {
            if (!selTrapSignalsTags.includes(dataType)) {
                const newChartDataMap = { ...chartDataMap };
                delete newChartDataMap[dataType];
                setChartDataMap(newChartDataMap);

                const newLoadingMap = { ...loadingMap };
                delete newLoadingMap[dataType];
                setLoadingMap(newLoadingMap);
            }
        });
    }, [selTrapSignalsTags]);

    const handleChartTypeChange = (dataType, type) => {
        setChartTypeMap(prev => ({ ...prev, [dataType]: type }));
    };

    const renderPieTooltip = ({ payload }) => {
        if (payload && payload.length) {
            const { name, value } = payload[0].payload;
            return (
                <div style={{ backgroundColor: '#fff', padding: '5px', border: '1px solid #ccc' }}>
                    <strong>{name}</strong>
                    <p>{`Count: ${value}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around' }}>
                {selTrapSignalsTags.map(dataType => {
                    const chartType = chartTypeMap[dataType] || 'BarChart';
                    const chartData = chartDataMap[dataType] || [];
                    const isLoading = loadingMap[dataType];

                    return (
                        <div key={dataType} className="signalRightElementContainer" style={{ width: '520px', height: '380px' }}>
                            <div className="signalRightElementHeader" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <h2 style={{ fontSize: '15px', marginLeft: '20px', fontWeight: 'bold', color: 'var(--textColor)' }}>
                                        {dataType ? dataType.charAt(0).toUpperCase() + dataType.slice(1) : 'Unknown'}
                                    </h2>
                                    <span style={{ fontSize: '14px', marginLeft: '5px', color: 'var(--textColor)' }}>- Signal Statistics</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginRight: '10px' }}>
                                    {chartType !== 'PieChart' && (
                                        <AiOutlinePieChart
                                            size={24}
                                            onClick={() => handleChartTypeChange(dataType, 'PieChart')}
                                            style={{
                                                cursor: 'pointer',
                                                color: '#999',
                                                transition: 'color 0.3s ease',
                                            }}
                                            title="Pie Chart"
                                        />
                                    )}
                                    {chartType !== 'BarChart' && (
                                        <IoBarChartOutline
                                            size={24}
                                            onClick={() => handleChartTypeChange(dataType, 'BarChart')}
                                            style={{
                                                cursor: 'pointer',
                                                color: '#999',
                                                transition: 'color 0.3s ease',
                                            }}
                                            title="Bar Chart"
                                        />
                                    )}
                                </div>
                            </div>

                            {isLoading && <Typography>Loading...</Typography>}

                            {!isLoading && chartData.length === 0 && (
                                <Typography>No data available for {dataType}</Typography>
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
                                        fill="#8884d8"
                                        label
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={renderPieTooltip} />
                                    <Legend />
                                </PieChart>
                            )}

                            {!isLoading && chartData.length > 0 && chartType === 'BarChart' && (
                                <BarChart width={480} height={300} data={chartData} top={20}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip content={renderPieTooltip} />
                                    <Legend />
                                    <Bar dataKey="value" fill="#8884d8">
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
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
