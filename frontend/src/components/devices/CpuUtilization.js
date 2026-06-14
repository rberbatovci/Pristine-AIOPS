import { useState, useEffect } from 'react';
import { RadialBarChart, PolarAngleAxis, RadialBar, Cell, ResponsiveContainer } from 'recharts';  
import { PiArrowsClockwiseDuotone, PiCpuDuotone } from 'react-icons/pi';
import kcFetch from '../misc/kcFetch';
import '../../css/CpuUtilizationModern.css'; // Path to the new CSS file

function CpuUtilization({ keycloak, selectedDevice, showNotification }) {
  const [device, setDevice] = useState(selectedDevice);
  const [error, setError] = useState('');
  const [cpuLoading, setCpuLoading] = useState(false);
  const [cpuTimestamp, setCpuTimestamp] = useState(null);

  // Default values arranged neatly from inner ring to outer ring
  const [cpuChartData, setCpuChartData] = useState([
    { name: '5m Avg', value: 0, key: 'five-minutes' },
    { name: '1m Avg', value: 0, key: 'one-minute' },
    { name: '5s Avg', value: 0, key: 'five-seconds' },
  ]);

  useEffect(() => {
    setDevice(selectedDevice);
  }, [selectedDevice]);

  // Helper to determine severity color based on percentage
  const getSeverityColor = (value) => {
    if (value >= 85) return 'var(--color-critical)';
    if (value >= 65) return 'var(--color-warning)';
    return 'var(--color-healthy)';
  };

  const getLastCpuStatus = async () => {
    if (!device?.hostname) return;
    setCpuLoading(true);
    setError('');
    try {
      const response = await kcFetch(keycloak, `/devices/status/${device.hostname}/cpu-util/`);
      if (response && response.stats && Object.keys(response.stats).length > 0) {
        const stats = response.stats;
        
        const newData = [
          { name: '5m Avg', value: Math.min(stats["five-minutes"] ?? 0, 100), key: 'five-minutes' },
          { name: '1m Avg', value: Math.min(stats["one-minute"] ?? 0, 100), key: 'one-minute' },
          { name: '5s Avg', value: Math.min(stats["five-seconds"] ?? 0, 100), key: 'five-seconds' },
        ];
        
        setCpuChartData(newData);
        setCpuTimestamp(response.msg_timestamp ? new Date(response.msg_timestamp).toLocaleTimeString() : null);
      } else {
        setError('No data available');
      }
    } catch (err) {
      setError(err.message || 'Fetch failed');
    } finally {
      setCpuLoading(false);
    }
  };

  useEffect(() => {
    getLastCpuStatus();
  }, [device]);

  return (
    <div className="cpu-monitor-card" style={{width: 'calc(50% - 40px)'}}> 
      {/* Visual Chart Area */}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius="100%"
            barSize={8}
            data={cpuChartData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: 'var(--bg-track)' }}
              clockWise
              dataKey="value"
              cornerRadius={4}
            >
              {cpuChartData.map((entry) => (
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
          className={`center-action-btn ${cpuLoading ? 'is-loading' : ''}`}
          onClick={getLastCpuStatus}
          disabled={cpuLoading}
          title="Refresh Metrics"
        >
          {cpuLoading ? (
            <PiArrowsClockwiseDuotone className="refresh-spinner" />
          ) : (
            <PiCpuDuotone className="cpu-core-icon" />
          )}
        </button>
      </div>

      {/* Metrics & Metadata Sidebar */}
      <div className="metrics-sidebar">
        <div className="sidebar-header">
          <h4>Core Telemetry</h4>
          <span className="timestamp-badge">
            {cpuTimestamp ? `Synced: ${cpuTimestamp}` : 'No Sync Data'}
          </span>
        </div>

        {error && <div className="metrics-error-banner">{error}</div>}

        <div className="telemetry-rows">
          {/* Reverse render order so 5s (outermost ring) sits cleanly at the top of the text list */}
          {[...cpuChartData].reverse().map((stat) => {
            const colorClass = stat.value >= 85 ? 'text-critical' : stat.value >= 65 ? 'text-warning' : 'text-healthy';
            return (
              <div className="metric-row" key={stat.name}>
                <div className="metric-meta">
                  <span className={`status-dot ${colorClass}`}></span>
                  <span className="metric-label">{stat.name}</span>
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

export default CpuUtilization;