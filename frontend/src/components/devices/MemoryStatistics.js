import { useState, useEffect } from 'react';
import { RadialBarChart, PolarAngleAxis, RadialBar, Cell, ResponsiveContainer } from 'recharts';  
import { PiArrowsClockwiseDuotone, PiDatabaseDuotone } from 'react-icons/pi';
import kcFetch from '../misc/kcFetch';
import '../../css/CpuUtilizationModern.css'; // Uses the same unified stylesheet

function MemoryStatistics({ keycloak, selectedDevice }) {
  const [device, setDevice] = useState(selectedDevice);
  const [error, setError] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [memoryTimestamp, setMemoryTimestamp] = useState(null);

  // Default states arranged systematically from inner to outer tracks
  const [memoryChartData, setMemoryChartData] = useState([
    { name: 'lsmpi_io', value: 0, label: 'LSMPI IO' },
    { name: 'reserve Processor', value: 0, label: 'Reserve Proc' },
    { name: 'Processor', value: 0, label: 'Main Processor' },
  ]);

  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  const getSeverityColor = (value) => {
    if (value >= 90) return 'var(--color-critical)';
    if (value >= 75) return 'var(--color-warning)';
    return 'var(--color-healthy)';
  };

  const getMemoryStatus = async () => {
    if (!device?.hostname) return;
    setMemoryLoading(true);
    setError('');
    try {
      // Fetching from the static/historic stats endpoint
      const response = await kcFetch(keycloak, `/devices/status/${device.hostname}/memory-stats/`);
      
      if (response && !response.error && Object.keys(response).length > 0) {
        const newData = [
          { name: 'lsmpi_io', value: Math.min(Number(response["lsmpi_io"]) || 0, 100), label: 'LSMPI IO' },
          { name: 'reserve Processor', value: Math.min(Number(response["reserve Processor"]) || 0, 100), label: 'Reserve Proc' },
          { name: 'Processor', value: Math.min(Number(response["Processor"]) || 0, 100), label: 'Main Processor' },
        ];
        
        setMemoryChartData(newData);
        setMemoryTimestamp(response.msg_timestamp ? new Date(response.msg_timestamp).toLocaleTimeString() : new Date().toLocaleTimeString());
      } else {
        setError(response.error || 'No data available');
      }
    } catch (err) {
      setError(err.message || 'Fetch failed');
    } finally {
      setMemoryLoading(false);
    }
  };

  useEffect(() => {
    getMemoryStatus();
  }, [device]);

  return (
    <div className="cpu-monitor-card" style={{width: 'calc(50% - 20px)', marginLeft: '10px'}}>
      
      {/* Visual Chart Area */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius="100%"
            barSize={8}
            data={memoryChartData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: 'var(--bg-track)' }}
              clockWise
              dataKey="value"
              cornerRadius={4}
            >
              {memoryChartData.map((entry) => (
                <Cell 
                  key={entry.name} 
                  fill={getSeverityColor(entry.value)} 
                />
              ))}
            </RadialBar>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Floating Center Control Button */}
        <button 
          className={`center-action-btn ${memoryLoading ? 'is-loading' : ''}`}
          onClick={getMemoryStatus}
          disabled={memoryLoading}
          title="Refresh Memory Pool Metrics"
        >
          {memoryLoading ? (
            <PiArrowsClockwiseDuotone className="refresh-spinner" />
          ) : (
            <PiDatabaseDuotone className="cpu-core-icon" />
          )}
        </button>
      </div>

      {/* Metrics & Metadata Sidebar */}
      <div className="metrics-sidebar">
        <div className="sidebar-header">
          <h4>Memory Pools</h4>
          <span className="timestamp-badge">
            {memoryTimestamp ? `Synced: ${memoryTimestamp}` : 'No Sync Data'}
          </span>
        </div>

        {error && <div className="metrics-error-banner">{error}</div>}

        <div className="telemetry-rows">
          {/* Reverse rendering ensures the Main Processor (outer track) stands at the top list position */}
          {[...memoryChartData].reverse().map((stat) => {
            const colorClass = stat.value >= 90 ? 'text-critical' : stat.value >= 75 ? 'text-warning' : 'text-healthy';
            return (
              <div className="metric-row" key={stat.name}>
                <div className="metric-meta">
                  <span className={`status-dot ${colorClass}`}></span>
                  <span className="metric-label">{stat.label}</span>
                </div>
                <div className={`metric-value ${colorClass}`}>
                  {stat.value}<span className="percent-sign">%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default MemoryStatistics;