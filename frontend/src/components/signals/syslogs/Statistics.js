import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Typography } from '@mui/material';
import kcFetch from '../../misc/kcFetch.js';
import '../../../css/SyslogDatabase.css';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";

function SyslogSignalStatistics({
  currentUser,
  setDashboardTitle,
  keycloak,
  showNotification,
  selectedTags = [
    { label: 'Device', value: 'device' },
    { label: 'Severity', value: 'severity' },
    { label: 'Mnemonic', value: 'mnemonic' },
    { label: 'State', value: 'state' },
    { label: 'Interface', value: 'interface' },
    { label: 'Neighbor', value: 'neighbor' }
  ],
  startTime,
  endTime
}) {
    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});
    const colorPalette = [
        '#FF6347', '#32CD32', '#FFD700',
        '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'
    ]; 
    
    useEffect(() => {
        if (!selectedTags.length) return;

        const fetchStatistics = async (dataType) => {
            setLoadingMap(prev => ({ ...prev, [dataType]: true }));

            const endpoint = `/events/signals/statistics/${dataType}`;

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

        // Fetch new tags only - Use tag.value
        selectedTags.forEach(tag => {
            if (!chartDataMap[tag.value] && !loadingMap[tag.value]) {
                fetchStatistics(tag.value);
            }
        });

        // Cleanup removed tags - Use .some() to match tag.value
        setChartDataMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!selectedTags.some(tag => tag.value === key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

        setLoadingMap(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(key => {
                if (!selectedTags.some(tag => tag.value === key)) {
                    delete updated[key];
                }
            });
            return updated;
        });

    }, [selectedTags, keycloak]);

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

    useEffect(() => {
        setDashboardTitle("Signals Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    return (
        <div>
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-around'
            }}>
                {selectedTags.map(tag => {
                    const dataType = tag.value;
                    const displayLabel = tag.label;
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
                                        {displayLabel}
                                    </h2>
                                    <span style={{
                                        fontSize: '14px',
                                        marginLeft: '5px',
                                        color: 'var(--textColor)'
                                    }}>
                                        - Event Statistics
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
                                <Typography>Loading...</Typography>
                            )}

                            {/* No Data */}
                            {!isLoading && chartData.length === 0 && (
                                <Typography>
                                    No data available for {displayLabel}
                                </Typography>
                            )}

                            {/* Pie Chart */}
                            {!isLoading && chartData.length > 0 && chartType === 'PieChart' && (
                                <PieChart width={440} height={270}>
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
                                <BarChart
                                    width={450}
                                    height={270}
                                    data={chartData}
                                    margin={{ top: 20 }}
                                Mention to keep it simple
                                >
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

export default SyslogSignalStatistics;