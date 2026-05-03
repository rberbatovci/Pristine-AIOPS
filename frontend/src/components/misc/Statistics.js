import { useState, useEffect } from 'react';
import Select from 'react-select';
import {
    PieChart, Pie, Cell, Tooltip as RechartsTooltip,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Typography } from '@mui/material';
import kcFetch from './kcFetch.js';
import '../../css/Statistics.css';
import { IoBarChartOutline } from "react-icons/io5";
import { AiOutlinePieChart } from "react-icons/ai";
import customStyles from "./SelectStyles";
import { ResponsiveContainer } from 'recharts';

function Statistics({ keycloak, source, dataSource, selectedTags = [], tags = [] }) {

    // 🔹 6 fixed slots
    const [slots, setSlots] = useState([
        { id: 1, name: null, tag: null, type: "BarChart" },
        { id: 2, name: null, tag: null, type: "BarChart" },
        { id: 3, name: null, tag: null, type: "BarChart" },
        { id: 4, name: null, tag: null, type: "BarChart" },
        { id: 5, name: null, tag: null, type: "BarChart" },
        { id: 6, name: null, tag: null, type: "BarChart" },
    ]);

    const [chartDataMap, setChartDataMap] = useState({});
    const [loadingMap, setLoadingMap] = useState({});
    const [chartTypeMap, setChartTypeMap] = useState({});

    const colorPalette = [
        '#FF6347', '#32CD32', '#FFD700',
        '#87CEEB', '#8A2BE2', '#FF69B4', '#20B2AA'
    ];

    useEffect(() => {
        console.log("Selected Tags updated:", selectedTags);
    }, [selectedTags]);

    useEffect(() => {
        console.log("Available tags in Statistics:", tags);
    }, [tags]);

    // 🔹 normalize tags
    const normalizeTags = (tags) => {
        const excluded = ["timestamp", "message", "sysUpTime", "content", "lsn"];

        return tags
            .map(tag => typeof tag === "string" ? tag : tag?.value)
            .filter(tag => tag && !excluded.includes(tag.toLowerCase()));
    };

    const availableTags = normalizeTags(selectedTags);

    // 🔥 PRESET LOGIC BASED ON SOURCE/DATASOURCE
    const getDefaultTags = () => {
        if (source === 'signals' && dataSource === 'snmptraps') {
            return ["enterprise", "agent", "severity"];
        }
        if (source === 'signals' && dataSource === 'syslogs') {
            return ["host", "severity", "facility"];
        }
        if (source === 'events' && dataSource === 'snmptraps') {
            return ["eventType", "device"];
        }
        if (source === 'events' && dataSource === 'syslogs') {
            return ["level", "source", "program"];
        }
        if (source === 'netflow') {
            return ["srcIp", "dstIp", "protocol"];
        }
        return [];
    };

    const getDefaultSlots = (src, dSrc, allTags) => {
        // Helper to find a tag regardless of case
        const findTag = (val) =>
            allTags.find(t => t.value.toLowerCase() === val.toLowerCase())?.value || null;

        let defaultValues = [];

        // Define the map of what tags should appear for which source
        if (src === 'signals' && dSrc === 'syslogs') {
            defaultValues = [findTag('device'), findTag('mnemonic'), findTag('severity')];
        } else if (src === 'signals' && dSrc === 'snmptraps') {
            defaultValues = [findTag('device'), findTag('snmpTrapOid')];
        } else if (src === 'events' && dSrc === 'netflow') {
            defaultValues = [
                findTag('device'), findTag('source_ip'), findTag('dest_ip'),
                findTag('protocol'), findTag('source_port'),
                findTag('dest_port')
            ];
        } else if (src === 'events' && dSrc === 'syslogs') {
            defaultValues = [findTag('device'), findTag('mnemonic'), findTag('severity'), findTag('interface'), findTag('state')];
        } else if (src === 'events' && dSrc === 'snmptraps') {
            defaultValues = [findTag('device'), findTag('snmpTrapOid')];
        }
        // Add other conditions here...

        // Map to the 6-slot structure
        return Array.from({ length: 6 }, (_, i) => ({
            id: i + 1,
            tag: defaultValues[i] || null, // Fill with tag or null if we don't have 6
            type: "BarChart"
        }));
    };

    useEffect(() => {
        if (slots.every(s => !s.tag)) {
            setSlots(getDefaultSlots(source, dataSource, tags));
        }
    }, [source, dataSource, tags]);


    const findTag = (value) => tags.find(t => t.value === value) || null;

    // 🔹 endpoint builder (unchanged)
    const buildEndpoint = (dataType) => {
        if (source === 'signals' && dataSource === 'snmptraps') {
            return `/signals/traps/statistics/${dataType}`;
        }
        if (source === 'signals' && dataSource === 'syslogs') {
            return `/signals/syslogs/statistics/${dataType}`;
        }
        if (source === 'events' && dataSource === 'snmptraps') {
            return `/events/traps/statistics/${dataType}`;
        }
        if (source === 'events' && dataSource === 'syslogs') {
            return `/events/syslogs/statistics/${dataType}`;
        }
        if (source === 'netflow') {
            return `/netflow/statistics/${dataType}`;
        }
        return `/events/syslogs/statistics/${dataType}`;
    };

    // 🔹 fetch data
    useEffect(() => {
        const fetchStatistics = async (dataType) => {
            if (!dataType) return;

            setLoadingMap(prev => ({ ...prev, [dataType]: true }));

            try {
                const endpoint = buildEndpoint(dataType);
                const data = await kcFetch(keycloak, endpoint);

                let processedData = [];

                if (Array.isArray(data?.statistics)) {
                    processedData = data.statistics.map(item => ({
                        name: item.value || item.name || "N/A",
                        value: item.count ?? 0,
                    }));
                } else if (typeof data === "object") {
                    processedData = Object.entries(data).map(([k, v]) => ({
                        name: k,
                        value: Number(v) || 0
                    }));
                }

                setChartDataMap(prev => ({
                    ...prev,
                    [dataType]: processedData
                }));

            } catch (err) {
                console.error(err);
            } finally {
                setLoadingMap(prev => ({
                    ...prev,
                    [dataType]: false
                }));
            }
        };

        slots.forEach(slot => {
            if (slot.tag && !chartDataMap[slot.tag]) {
                fetchStatistics(slot.tag);
            }
        });

    }, [slots]);

    // 🔹 update slot
    const handleTagChange = (slotId, value) => {
        setSlots(prev =>
            prev.map(s =>
                s.id === slotId ? { ...s, tag: value } : s
            )
        );
    };

    const renderTooltip = ({ payload }) => {
        if (payload?.length) {
            const { name, value } = payload[0].payload;
            return (
                <div style={{
                    background: "#fff",
                    border: "1px solid #ccc",
                    padding: 6
                }}>
                    <strong>{name}</strong>
                    <p>{value}</p>
                </div>
            );
        }
        return null;
    };

    const handleChartTypeChange = (dataType, type) => {
        setChartTypeMap(prev => ({ ...prev, [dataType]: type }));
    };

    return (
        <div className="statistics-grid">
            {slots.map(slot => {
                const dataType = slot.tag;
                const chartData = chartDataMap[dataType] || [];
                const isLoading = loadingMap[dataType];
                const chartType = chartTypeMap[dataType] || "BarChart";

                return (
                    <div key={slot.id} className="statistics-slot" >
                        <div
                            className="statistics-slot-header"
                            style={{ marginBottom: '20px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <Select
                                    options={tags}
                                    value={tags.find(t => t.value === dataType) || null}
                                    onChange={(selected) => handleTagChange(slot.id, selected?.value || null)}
                                    placeholder="Select field"
                                    styles={{
                                        ...customStyles("275px"),
                                        menuPortal: base => ({ ...base, zIndex: 9999 })
                                    }}
                                />
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

                        {!dataType && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 250, color: "#888" }}>
                                Select a field
                            </div>
                        )}

                        {isLoading && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 250, color: "#888" }}>
                                Loading...
                            </div>
                        )}

                        {!isLoading && dataType && chartData.length === 0 && (
                            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 250, color: "#888" }}>
                                No data available
                            </div>
                        )} 
 
                        {!isLoading && chartData.length > 0 && chartType === "PieChart" && (
                            <ResponsiveContainer width="100%" height={270}>
                                <PieChart>
                                    <Pie data={chartData} dataKey="value" nameKey="name">
                                        {chartData.map((_, i) => (
                                            <Cell key={i} fill={colorPalette[i % colorPalette.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={renderTooltip} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
 
                        {!isLoading && chartData.length > 0 && chartType === "BarChart" && (
                            <ResponsiveContainer width="100%" height={270}>
                                <BarChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <RechartsTooltip content={renderTooltip} />
                                    <Bar dataKey="value">
                                        {chartData.map((_, i) => (
                                            <Cell key={i} fill={colorPalette[i % colorPalette.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}

                    </div>
                );
            })}
        </div>
    );
}

export default Statistics;