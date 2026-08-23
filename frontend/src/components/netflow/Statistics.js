import { useState, useEffect } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip as RechartsTooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid
} from 'recharts';
import { Typography } from '@mui/material';
import '../../css/SyslogDatabase.css';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";
import { useNetflowStatistics } from '../../hooks/useNetflowStatistics';


function TrafficStatistics({
    currentUser,
    setDashboardTitle,
    keycloak,
    showNotification,
    selectedTags = [
        { label: 'Device', value: 'device' },
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Protocol', value: 'protocol' },
        { label: 'Destination IP', value: 'dest_ip' },
        { label: 'Destination Port', value: 'dest_port' }
    ],
    startTime,
    endTime
}) {
    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});
    const [metricMap, setMetricMap] = useState({});
    const { loadStatistics } = useNetflowStatistics();
    const colorPalette = [
        '#FF6347',
        '#32CD32',
        '#FFD700',
        '#87CEEB',
        '#8A2BE2',
        '#FF69B4',
        '#20B2AA'
    ];

    useEffect(() => {
        if (!selectedTags.length) { return; }
        setMetricMap(prev => {
            const updated = { ...prev };
            selectedTags.forEach(tag => {
                const dataType =
                    typeof tag === 'object' && tag !== null
                        ? tag.value
                        : tag;
                if (dataType && !updated[dataType]) {
                    updated[dataType] = 'bytes';
                }
            });
            Object.keys(updated).forEach(key => {
                const stillSelected = selectedTags.some(tag => {
                    const value =
                        typeof tag === 'object' && tag !== null
                            ? tag.value
                            : tag;
                    return value === key;
                });
                if (!stillSelected) {
                    delete updated[key];
                }
            });
            return updated;
        });

    }, [selectedTags]);

    useEffect(() => {
        if (!selectedTags.length) { return; }
        const activeTagValues = selectedTags
            .map(tag =>
                typeof tag === 'object' && tag !== null
                    ? tag.value
                    : tag
            )
            .filter(Boolean);
        const fetchStatistics = async (dataType) => {
            const metric = metricMap[dataType] || 'bytes';
            setLoadingMap(prev => ({
                ...prev,
                [dataType]: true
            }));
            try {
                const results = await loadStatistics({
                    keycloak,
                    metric,
                    field: dataType,
                    startTime,
                    endTime
                });
                const processedData = (results || []).map(item => ({
                    name: item.name,
                    value: item.total,
                    count: item.count
                }));
                setChartDataMap(prev => ({
                    ...prev,
                    [dataType]: processedData
                }));
            } catch (error) {
                console.error(
                    `Error fetching ${metric} statistics for ${dataType}:`,
                    error
                );
                setChartDataMap(prev => ({
                    ...prev,
                    [dataType]: []
                }));
            } finally {
                setLoadingMap(prev => ({
                    ...prev,
                    [dataType]: false
                }));
            }
        };

        activeTagValues.forEach(dataType => {
            fetchStatistics(dataType);
        });

        setChartDataMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!activeTagValues.includes(key)) {
                    delete updated[key];
                }
            });
            return updated;
        });


        setLoadingMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!activeTagValues.includes(key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

    }, [
        selectedTags,
        startTime,
        endTime,
        keycloak,
        metricMap,
        loadStatistics
    ]);

    const handleChartTypeChange = (dataType, type) => {
        setChartTypeMap(prev => ({
            ...prev,
            [dataType]: type
        }));
    };

    const handleMetricChange = (dataType, metric) => {
        setMetricMap(prev => ({
            ...prev,
            [dataType]: metric
        }));
    };

    const formatValue = (value, metric) => {
        if (value === null || value === undefined) {
            return '0';
        } 
        if (metric === 'bytes') {
            if (value >= 1_000_000_000) {
                return `${(value / 1_000_000_000).toFixed(2)} GB`;
            }
            if (value >= 1_000_000) {
                return `${(value / 1_000_000).toFixed(2)} MB`;
            }
            if (value >= 1_000) {
                return `${(value / 1_000).toFixed(2)} KB`;
            }
            return `${value} B`;
        } 
        if (value >= 1_000_000_000) {
            return `${(value / 1_000_000_000).toFixed(2)} B`;
        } 
        if (value >= 1_000_000) {
            return `${(value / 1_000_000).toFixed(2)} M`;
        } 
        if (value >= 1_000) {
            return `${(value / 1_000).toFixed(2)} K`;
        } 
        return value.toLocaleString();
    };


    /*
     * Tooltip.
     */
    const renderTooltip = ({ payload }) => { 
        if (!payload || !payload.length) {
            return null;
        } 
        const data = payload[0].payload; 
        return (
            <div
                style={{
                    backgroundColor: '#fff',
                    padding: '8px',
                    border: '1px solid #ccc'
                }} >
                <strong>{data.name}</strong> 
                <p style={{ margin: '5px 0' }}>
                    Value: {formatValue(
                        data.value,
                        'bytes'
                    )}
                </p> 
                <p style={{ margin: '5px 0' }}>
                    Flows: {data.count?.toLocaleString()}
                </p>
            </div>
        );
    };
 
    useEffect(() => { 
        setDashboardTitle("Traffic Dashboard"); 
        return () => setDashboardTitle(''); 
    }, [setDashboardTitle]);


    return (
        <div> 
            <div
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-around'
                }} > 
                {selectedTags.map(tag => { 
                    const dataType = tag.value;
                    const displayLabel = tag.label; 
                    const chartType =
                        chartTypeMap[dataType] || 'BarChart'; 
                    const metric =
                        metricMap[dataType] || 'bytes'; 
                    const chartData =
                        chartDataMap[dataType] || []; 
                    const isLoading =
                        loadingMap[dataType];
 
                    return (
                        <div
                            key={dataType}
                            className="signalRightElementContainer"
                            style={{
                                width: '540px',
                                height: '380px'
                            }} > 
                            <div
                                className="signalRightElementHeader"
                                style={{
                                    marginBottom: '20px'
                                }} > 
                                <div style={{ display: 'flex', alignItems: 'center' }} > 
                                    <h2
                                        style={{
                                            fontSize: '15px',
                                            marginLeft: '20px',
                                            fontWeight: 'bold',
                                            color: 'var(--textColor)'
                                        }} >
                                        {displayLabel}
                                    </h2> 
                                    <span
                                        style={{
                                            fontSize: '14px',
                                            marginLeft: '5px',
                                            color: 'var(--textColor)'
                                        }} >
                                        - Traffic Statistics
                                    </span>

                                </div>
 
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: '8px',
                                        alignItems: 'center',
                                        marginRight: '10px'
                                    }} > 
                                    <div
                                        style={{
                                            display: 'flex',
                                            border: '1px solid #ccc',
                                            borderRadius: '5px',
                                            overflow: 'hidden'
                                        }} > 
                                        <button
                                            onClick={() =>
                                                handleMetricChange(
                                                    dataType,
                                                    'bytes'
                                                )
                                            }
                                            style={{
                                                border: 'none',
                                                padding: '4px 9px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                backgroundColor:
                                                    metric === 'bytes'
                                                        ? '#1976d2'
                                                        : 'transparent',
                                                color:
                                                    metric === 'bytes'
                                                        ? '#fff'
                                                        : 'var(--textColor)'
                                            }}
                                        >
                                            Bytes
                                        </button>

                                        <button
                                            onClick={() =>
                                                handleMetricChange(
                                                    dataType,
                                                    'packets'
                                                )
                                            }
                                            style={{
                                                border: 'none',
                                                borderLeft: '1px solid #ccc',
                                                padding: '4px 9px',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                backgroundColor:
                                                    metric === 'packets'
                                                        ? '#1976d2'
                                                        : 'transparent',
                                                color:
                                                    metric === 'packets'
                                                        ? '#fff'
                                                        : 'var(--textColor)'
                                            }}
                                        >
                                            Packets
                                        </button>

                                    </div>


                                    {/* Pie chart */}

                                    {chartType !== 'PieChart' && (
                                        <AiOutlinePieChart
                                            size={24}
                                            onClick={() =>
                                                handleChartTypeChange(
                                                    dataType,
                                                    'PieChart'
                                                )
                                            }
                                            style={{
                                                cursor: 'pointer',
                                                color: '#999'
                                            }}
                                            title="Pie Chart"
                                        />
                                    )}


                                    {/* Bar chart */}

                                    {chartType !== 'BarChart' && (
                                        <IoBarChartOutline
                                            size={24}
                                            onClick={() =>
                                                handleChartTypeChange(
                                                    dataType,
                                                    'BarChart'
                                                )
                                            }
                                            style={{
                                                cursor: 'pointer',
                                                color: '#999'
                                            }}
                                            title="Bar Chart"
                                        />
                                    )}

                                </div>

                            </div>

                            {isLoading && (
                                <Typography>
                                    Loading...
                                </Typography>
                            )}

                            {!isLoading &&
                                chartData.length === 0 && (
                                    <Typography>
                                        No data available for {displayLabel}
                                    </Typography>
                                )}

                            {!isLoading &&
                                chartData.length > 0 &&
                                chartType === 'PieChart' && (

                                    <PieChart
                                        width={440}
                                        height={270} >
                                        <Pie
                                            data={chartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80} >
                                            {chartData.map(
                                                (entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={
                                                            colorPalette[
                                                            index %
                                                            colorPalette.length
                                                            ]
                                                        }
                                                    />
                                                )
                                            )}
                                        </Pie>
                                        <RechartsTooltip content={renderTooltip} />
                                    </PieChart>
                                )}

                            {!isLoading &&
                                chartData.length > 0 &&
                                chartType === 'BarChart' && (
                                    <BarChart
                                        width={450}
                                        height={270}
                                        data={chartData}
                                        margin={{
                                            top: 20
                                        }} >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <RechartsTooltip content={renderTooltip} />
                                        <Bar dataKey="value">
                                            {chartData.map(
                                                (entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
                                                        fill={
                                                            colorPalette[
                                                            index %
                                                            colorPalette.length
                                                            ]
                                                        }
                                                    />
                                                )
                                            )}
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

export default TrafficStatistics;