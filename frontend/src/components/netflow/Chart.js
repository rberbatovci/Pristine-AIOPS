import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Typography } from '@mui/material';
import apiClient from '../misc/AxiosConfig.js';
import '../../css/SyslogDatabase.css';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";

function NetflowChart() {
    // Define tags with label/value
    const [selEventsTags, setSelEventsTags] = useState([
        { label: 'Device', value: 'exporter_ip'},
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Destination IP', value: 'destination_ip' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Destination Port', value: 'destination_port' },
        { label: 'Protocol', value: 'protocol' },
    ]);

    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});

    const colorPalette = ['#FF6347', '#32CD32', '#FFD700', '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'];

    // Fetch data whenever tags change
    useEffect(() => {
        selEventsTags.forEach(({ value }) => {
            if (!chartDataMap[value] && !loadingMap[value]) {
                setLoadingMap(prev => ({ ...prev, [value]: true }));

                const endpoint = `/syslogs/statistics/${value}/`;

                apiClient.get(endpoint)
                    .then(response => {
                        let processedData = [];
                        if (Array.isArray(response.data.statistics)) {
                            processedData = response.data.statistics.map(item => ({
                                name: item.value,
                                value: item.count
                            }));
                        } else if (typeof response.data === 'object') {
                            processedData = Object.entries(response.data).map(
                                ([key, val]) => ({ name: key, value: val })
                            );
                        }

                        setChartDataMap(prev => ({ ...prev, [value]: processedData }));
                        setLoadingMap(prev => ({ ...prev, [value]: false }));
                    })
                    .catch(error => {
                        console.error(`Error fetching data for ${value}:`, error);
                        setChartDataMap(prev => ({ ...prev, [value]: [] }));
                        setLoadingMap(prev => ({ ...prev, [value]: false }));
                    });
            }
        });

        // Cleanup removed types
        Object.keys(chartDataMap).forEach(key => {
            if (!selEventsTags.some(tag => tag.value === key)) {
                const newChartDataMap = { ...chartDataMap };
                delete newChartDataMap[key];
                setChartDataMap(newChartDataMap);
            }
        });
    }, [selEventsTags]);

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
                {selEventsTags.map(({ label, value }) => {
                    const chartType = chartTypeMap[value] || 'BarChart';
                    const chartData = chartDataMap[value] || [];
                    const isLoading = loadingMap[value];

                    return (
                        <div key={value} className="signalRightElementContainer" style={{ width: '470px', height: '380px' }}>
                            <div className="signalRightElementHeader" style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <h2 style={{ fontSize: '15px', marginLeft: '20px', fontWeight: 'bold', color: 'var(--textColor)' }}>
                                        {label}
                                    </h2>
                                    <span style={{ fontSize: '14px', marginLeft: '5px', color: 'var(--textColor)' }}>- Traffic Statistics</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginRight: '10px' }}>
                                    {chartType !== 'PieChart' && (
                                        <AiOutlinePieChart
                                            size={24}
                                            onClick={() => handleChartTypeChange(value, 'PieChart')}
                                            style={{ cursor: 'pointer', color: '#999', transition: 'color 0.3s ease' }}
                                            title="Pie Chart"
                                        />
                                    )}
                                    {chartType !== 'BarChart' && (
                                        <IoBarChartOutline
                                            size={24}
                                            onClick={() => handleChartTypeChange(value, 'BarChart')}
                                            style={{ cursor: 'pointer', color: '#999', transition: 'color 0.3s ease' }}
                                            title="Bar Chart"
                                        />
                                    )}
                                </div>
                            </div>

                            {isLoading && <Typography>Loading...</Typography>}
                            {!isLoading && chartData.length === 0 && (
                                <Typography>No data available for {label}</Typography>
                            )}

                            {!isLoading && chartData.length > 0 && chartType === 'PieChart' && (
                                <PieChart left={-10} width={440} height={270}>
                                    <Pie
                                        data={chartData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#020027ff"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={renderPieTooltip} />
                                </PieChart>
                            )}

                            {!isLoading && chartData.length > 0 && chartType === 'BarChart' && (
                                <BarChart left={-100} width={450} height={270} data={chartData} margin={{ top: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip content={renderPieTooltip} />
                                    <Bar dataKey="value">
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

export default NetflowChart;
