import React, { useState, useMemo, useEffect } from 'react';
import '../../css/SignalInfo.css';
import apiClient from '../misc/AxiosConfig';
import Select from 'react-select';
import customStyles from '../misc/SelectStyles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import moment from 'moment';

const MemoryStats = ({ currentUser, selectedDevice }) => {
  const [showData, setShowData] = useState(true);
  const [memoryStatistics, setMemoryStatistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const memories = [
    { value: 'lsmpi_io', label: 'LSMPI IO' },
    { value: 'reserve Processor', label: 'Reserve Processor' },
    { value: 'Processor', label: 'Processor' },
  ];
  const [selectedMemory, setSelectedMemory] = useState(memories[2]);

  // Fetch memory statistics when device or selected memory changes
  useEffect(() => {
    const fetchMemoryStatistics = async () => {
      if (!selectedDevice?.hostname || !selectedMemory) return;

      setLoading(true); // Add this
      setError(null);   // Add this

      try {
        const res = await apiClient.get(`/telemetry/memory-statistics/`, {
          params: {
            device: selectedDevice.hostname,
            memory: selectedMemory.value,
          }
        });

        const formatted = res.data.results.map((item) => ({
          timestamp: moment(item.ingested_at).format("HH:mm:ss"),
          freeMemory: item.stats?.["free-memory"] ?? 0,
          highestUsage: item.stats?.["highest-usage"] ?? 0,
          lowestUsage: item.stats?.["lowest-usage"] ?? 0,
          totalMemory: item.stats?.["total-memory"] ?? 0,
          usedMemory: item.stats?.["used-memory"] ?? 0,
        }));

        setMemoryStatistics(formatted);
      } catch (err) {
        console.error('Error fetching memory statistics:', err);
        setError("Failed to fetch memory statistics.");
      } finally {
        setLoading(false);
      }
    };

    if (selectedDevice && selectedMemory) {
      fetchMemoryStatistics();
    }
  }, [selectedDevice, selectedMemory]);

  const yDomain = useMemo(() => {
    if (memoryStatistics.length === 0) return ['auto', 'auto'];

    const allValues = memoryStatistics.flatMap(item => [
      item.freeMemory,
      item.highestUsage,
      item.lowestUsage,
      item.totalMemory,
      item.usedMemory
    ]).filter(v => typeof v === 'number');

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    return [Math.floor(min * 0.95), Math.ceil(max * 1.05)];
  }, [memoryStatistics]);

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Memory Statistics
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons" style={{ display: 'flex', gap: '10px' }}>
              <Select
                onChange={(option) => setSelectedMemory(option)}
                options={memories}
                styles={{
                  ...customStyles('190px'),
                  menuPortal: base => ({ ...base, zIndex: 9999 }),
                }}
                placeholder="Select memory"
                value={selectedMemory}
                isClearable={true}
                menuPortalTarget={document.body}
                isDisabled={!selectedDevice}
              />
            </div>
          </div>
        )}
      </div>

      {showData && (
        <div style={{ paddingTop: "10px" }}>
          {loading ? (
            <div className="p-4 text-gray-500">Loading Memory utilization stats...</div>
          ) : error ? (
            <div className="p-4 text-red-500">{error}</div>
          ) : memoryStatistics.length === 0 ? (
            <div className="p-4">No Memory utilization stats found for this device.</div>
          ) : (
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={memoryStatistics}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                  <XAxis dataKey="timestamp" />
                  <YAxis domain={[0, 1000000000]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="freeMemory" stroke="#8884d8" dot={false} activeDot={{ r: 4 }} name="Free Memory" />
                  <Line type="monotone" dataKey="highestUsage" stroke="#82ca9d" dot={false} activeDot={{ r: 4 }} name="Highest Usage" />
                  <Line type="monotone" dataKey="lowestUsage" stroke="#ffc658" dot={false} activeDot={{ r: 4 }} name="Lowest Usage" />
                  <Line type="monotone" dataKey="totalMemory" stroke="#a83279" dot={false} activeDot={{ r: 4 }} name="Total Memory" />
                  <Line type="monotone" dataKey="usedMemory" stroke="#ff7300" dot={false} activeDot={{ r: 4 }} name="Used Memory" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemoryStats;
