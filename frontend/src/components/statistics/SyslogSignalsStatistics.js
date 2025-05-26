import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
    Typography, MenuItem, FormControl,
    InputLabel, OutlinedInput
} from '@mui/material';
import apiClient from '../misc/AxiosConfig.js';
import '../../css/SyslogDatabase.css';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 200,
        },
    },
};

function SyslogSignalsStatistics() {
    const [selectedDataTypes, setSelectedDataTypes] = useState(['devices', 'mnemonics', 'rule', 'status']);
    const [availableDataTypes, setAvailableDataTypes] = useState([]);
    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({}); // ✅ NEW: Chart type per data type

    const colorPalette = ['#FF6347', '#32CD32', '#FFD700', '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'];

    const additionalDataTypes = [
        { name: 'devices' },
        { name: 'mnemonics' },
        { name: 'rule' },
        { name: 'status' }
    ];

    useEffect(() => {
        apiClient.get('/syslogs/tags/')
            .then(response => {
                const serverDataTypes = response.data.map(item => item.name);
                const allAvailableTypes = [...serverDataTypes, ...additionalDataTypes.map(item => item.name)];
                setAvailableDataTypes(allAvailableTypes);
            })
            .catch(error => console.error('Error fetching available data types:', error));
    }, []);

    useEffect(() => {
        selectedDataTypes.forEach(dataType => {
            if (!chartDataMap[dataType] && !loadingMap[dataType]) {
                setLoadingMap(prev => ({ ...prev, [dataType]: true }));

                // Decide the correct endpoint
                const isDirectType = ['devices', 'mnemonics', 'rule', 'status'].includes(dataType);
                const endpoint = isDirectType
                    ? `/signals/stats/${dataType}/`
                    : `/signals/stats/affected_entities/${dataType}/`;

                apiClient.get(endpoint)
                    .then(response => {
                        let processedData = [];
                        if (response.data && Array.isArray(response.data)) {
                            processedData = response.data.map(item => ({
                                name: item.name || item.device || item.hostname || item.mnemonic || 'Item',
                                value: item.count || item.value || 1,
                            }));
                        } else if (response.data && typeof response.data === 'object') {
                            processedData = Object.entries(response.data).map(([key, value]) => ({ name: key, value: value }));
                        } else {
                            console.warn(`Data format not recognized for ${dataType}.`);
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

        // Clean up data for deselected types
        Object.keys(chartDataMap).forEach(dataType => {
            if (!selectedDataTypes.includes(dataType)) {
                const newChartDataMap = { ...chartDataMap };
                delete newChartDataMap[dataType];
                setChartDataMap(newChartDataMap);

                const newLoadingMap = { ...loadingMap };
                delete newLoadingMap[dataType];
                setLoadingMap(newLoadingMap);
            }
        });
    }, [selectedDataTypes]);

    const handleDataTypeChange = (event) => {
        const newSelection = event.target.value;
        setSelectedDataTypes(newSelection);
    };

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

    const chartOptions = [
        { value: 'PieChart', label: 'Pie Chart' },
        { value: 'BarChart', label: 'Bar Chart' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around' }}>
                {selectedDataTypes.map(dataType => {
                    const chartType = chartTypeMap[dataType] || 'BarChart';
                    const chartData = chartDataMap[dataType] || [];
                    const isLoading = loadingMap[dataType];

                    return (
                        <div className="signalRightElementContainer" style={{ width: '520px', height: '380px' }}>
                            <div className="signalRightElementHeader" style={{marginBottom: '20px'}}>
                                <h2 className="signalRightElementHeaderTxt">
                                    {dataType.charAt(0).toUpperCase() + dataType.slice(1)} Statistics
                                </h2>
                                <div style={{ width: '200px', zIndex: '50' }}>
                                    <Select
                                        value={chartOptions.find(option => option.value === chartType)}
                                        onChange={selectedOption => handleChartTypeChange(dataType, selectedOption.value)}
                                        options={chartOptions}
                                        placeholder="Select chart type"
                                        styles={customStyles('190px')}
                                    />
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
                                    <CartesianGrid strokeDasharray="4 4" />
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

export default SyslogSignalsStatistics;
