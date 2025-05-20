import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../App.css';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';

function Statistics() {
    const [signalData, setSignalData] = useState([]);
    const [signalCounts, setSignalCounts] = useState({});
    const [hostnameCounts, setHostnameCounts] = useState({});
    const [chartType, setChartType] = useState('PieChart');
    const [dataType, setDataType] = useState('signalState');

    useEffect(() => {
        // Fetch signal data from the server
        axios.get('http://localhost:8000/signals/api/')
            .then(response => {
                setSignalData(response.data);
            })
            .catch(error => {
                console.error('Error fetching signal data:', error);
            });
    }, []);

    // Calculate the counts for each signal state and collect signal IDs
    useEffect(() => {
        const counts = signalData.reduce((acc, signal) => {
            if (!acc[signal.state]) {
                acc[signal.state] = { count: 0, ids: [] };
            }
            acc[signal.state].count += 1;
            acc[signal.state].ids.push(signal.id);
            return acc;
        }, {});
        setSignalCounts(counts);

        // Calculate the counts for each hostname
        const hostnameCounts = signalData.reduce((acc, signal) => {
            if (!acc[signal.hostname]) {
                acc[signal.hostname] = 0;
            }
            acc[signal.hostname] += 1;
            return acc;
        }, {});
        setHostnameCounts(hostnameCounts);
    }, [signalData]);

    // Define a palette of 7 colors
    const colorPalette = ['#FF6347', '#32CD32', '#FFD700', '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'];

    // Prepare data for PieChart and BarChart
    const pieData = Object.entries(signalCounts).map(([state, { count, ids }]) => ({
        name: state,
        value: count,
        ids: ids,
    }));

    const barData = Object.entries(hostnameCounts).map(([hostname, count]) => ({
        hostname,
        count,
    }));

    const renderPieTooltip = ({ payload }) => {
        if (payload && payload.length) {
            const { name, value, ids } = payload[0].payload;
            return (
                <div style={{ backgroundColor: '#fff', padding: '5px', border: '1px solid #ccc' }}>
                    <strong>{`${name} Signals`}</strong>
                    <p>{`Count: ${value}`}</p>
                    <p>{`IDs: ${ids.join(', ')}`}</p>
                </div>
            );
        }
        return null;
    };

    const renderBarTooltip = ({ payload }) => {
        if (payload && payload.length) {
            const { hostname, count } = payload[0].payload;
            return (
                <div style={{ backgroundColor: '#fff', padding: '5px', border: '1px solid #ccc' }}>
                    <strong>{`Hostname: ${hostname}`}</strong>
                    <p>{`Count: ${count}`}</p>
                </div>
            );
        }
        return null;
    };

    const handleChartTypeChange = (event) => {
        setChartType(event.target.value);
    };

    const handleDataTypeChange = (event) => {
        setDataType(event.target.value);
    };

    return (
        <div
            className="bgcol2"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 110px)',
                marginTop: '20px',
                marginBottom: '20px',
                marginLeft: '20px',
                marginRight: '20px',
                width: '80%',
                padding: '10px',
                boxShadow: '3px 10px 20px rgba(0, 0, 0, 0.2)',
                borderTop: 'var(--border-color2)',
                borderBottom: 'var(--border-color3)',
                borderRadius: '10px',
                color: 'var(--text-color2)',
                overflowX: 'auto',
                background: 'var(--contentBackground)',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '-10px' }}>
                <h2 style={{ marginTop: '15px', paddingLeft: '20px', color: 'var(--text-color)' }}>Signals List</h2>
                <FormControl variant="outlined" style={{ marginBottom: '20px', width: '200px' }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select value={chartType} onChange={handleChartTypeChange} label="Chart Type">
                        <MenuItem value="PieChart">PieChart</MenuItem>
                        <MenuItem value="BarChart">BarChart</MenuItem>
                    </Select>
                </FormControl>
                <FormControl variant="outlined" style={{ marginBottom: '20px', width: '200px' }}>
                    <InputLabel>Data Type</InputLabel>
                    <Select value={dataType} onChange={handleDataTypeChange} label="Data Type">
                        <MenuItem value="signalState">Signal State</MenuItem>
                        <MenuItem value="hostname">Hostname</MenuItem>
                    </Select>
                </FormControl>

                {chartType === 'PieChart' && dataType === 'signalState' && (
                    <PieChart width={400} height={400}>
                        <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            label
                        >
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip content={renderPieTooltip} />
                    </PieChart>
                )}

                {chartType === 'BarChart' && dataType === 'signalState' && (
                    <BarChart
                        width={600}
                        height={300}
                        data={pieData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <RechartsTooltip content={renderPieTooltip} />
                        <Legend />
                        <Bar dataKey="value" fill="#8884d8">
                            {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                )}

                {chartType === 'PieChart' && dataType === 'hostname' && (
                    <PieChart width={400} height={400}>
                        <Pie
                            data={barData}
                            dataKey="count"
                            nameKey="hostname"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            label
                        >
                            {barData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                            ))}
                        </Pie>
                        <RechartsTooltip content={renderBarTooltip} />
                    </PieChart>
                )}

                {chartType === 'BarChart' && dataType === 'hostname' && (
                    <BarChart
                        width={600}
                        height={300}
                        data={barData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hostname" />
                        <YAxis />
                        <RechartsTooltip content={renderBarTooltip} />
                        <Legend />
                        <Bar dataKey="count" fill="#8884d8">
                            {barData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={colorPalette[index % colorPalette.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                )}
            </div>
        </div>
    );
}

export default Statistics;
