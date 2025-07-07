import React, { useState, useEffect } from 'react';
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
  ResponsiveContainer
} from 'recharts';
import moment from 'moment';

const ISISStats = ({ currentUser, selectedDevice }) => {
  const [showData, setShowData] = useState(false);
  const [selectedInterface, setSelectedInterface] = useState(null);
  const [interfaceStats, setInterfaceStats] = useState([]);
  const [selectedKPI, setSelectedKPI] = useState({ value: 'in-octets', label: 'in-octets' });

  const interfaces = [
    { value: 'GigabitEthernet1', label: 'GigabitEthernet1' },
    { value: 'GigabitEthernet2', label: 'GigabitEthernet2' },
    { value: 'GigabitEthernet3', label: 'GigabitEthernet3' },
    { value: 'GigabitEthernet4', label: 'GigabitEthernet4' },
    { value: 'Loopback0', label: 'Loopback0' },
  ];

  const kpiOptions = [
    'in-octets',
    'out-octets',
    'in-unicast-pkts',
    'out-unicast-pkts',
    'in-errors',
    'out-errors',
    'rx-kbps',
    'tx-kbps',
    'in-crc-errors',
    'in-discards'
  ].map(kpi => ({ value: kpi, label: kpi }));

  const fetchInterfaceStatistics = async (selectedOption) => {
    setSelectedInterface(selectedOption);

    try {
      const response = await apiClient.get(`/telemetry/interface-statistics/`, {
        params: {
          device_id: selectedDevice.hostname,
          interface_name: selectedOption.value,
          size: 10,
          from_: 0
        }
      });
      setInterfaceStats(response.data);
    } catch (err) {
      console.error('Error fetching interface statistics:', err);
    }
  };

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`} >
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Signal Info
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons" style={{ display: 'flex', gap: '10px' }}>
              <Select
                onChange={fetchInterfaceStatistics}
                options={interfaces}
                placeholder="Select interface"
                styles={customStyles('190px')}
                value={selectedInterface}
              />
              <Select
                onChange={setSelectedKPI}
                options={kpiOptions}
                placeholder="Select KPI"
                styles={customStyles('190px')}
                value={selectedKPI}
              />
            </div>
          </div>
        )}
      </div>

      {showData && (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
          <div style={{ width: '100%' }}>
            {interfaceStats.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={interfaceStats.map(item => ({
                      timestamp: moment(item.ingested_at).format('HH:mm:ss'),
                      value: item.stats?.content?.[selectedKPI.value] || 0
                    }))}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p>No data available for the selected interface.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ISISStats;
