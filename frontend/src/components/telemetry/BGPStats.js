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

const InterfaceOper = ({ currentUser, selectedDevice }) => {
  const [showData, setShowData] = useState(true);
  const [selectedInterface, setSelectedInterface] = useState(null);
  const [interfaceStatistics, setInterfaceStatistics] = useState([]);
  const [availableInterfaces, setAvailableInterfaces] = useState([]); // New state for available interfaces

  useEffect(() => {
      if (!selectedDevice) {
        setShowData(false);
        setInterfaceStatistics([]);
      } else {
        setShowData(true);
      }
    }, [selectedDevice]);

  // Set default selected interface on mount or when availableInterfaces change
  useEffect(() => {
    if (availableInterfaces.length > 0 && !selectedInterface) {
      setSelectedInterface(availableInterfaces[0]); // Default to the first available interface
    }
  }, [availableInterfaces, selectedInterface]);


  // Fetch interface statistics when device or selected interface changes
  useEffect(() => {
    const fetchInterfaceStatistics = async () => {
      if (!selectedDevice || !selectedInterface) {
        setInterfaceStatistics([]); // Clear data if no device or interface selected
        return;
      }

      try {
        const res = await apiClient.get(`/telemetry/bgp-statistics/`, {
          params: {
            device: selectedDevice,
            interface: selectedInterface.value,
          }
        });

        // Filter and map the data based on the provided statistics structure
        const formatted = res.data.results.map((item) => ({
          timestamp: moment(item.ingested_at).format("HH:mm:ss"),
          ether_state: item.stats?.["ether-state"] ?? 0,
          oper_status: item.stats?.["oper-status"] ?? 0,
        }));

        setInterfaceStatistics(formatted);
        console.log('Interface statistics fetched:', formatted);
      } catch (err) {
        console.error('Error fetching interface statistics:', err);
        setInterfaceStatistics([]);
      }
    };

    fetchInterfaceStatistics();
  }, [selectedDevice, selectedInterface]); // Dependency on selectedInterface now

  useEffect(() => {
    const fetchInterfaces = async () => {
      if (!selectedDevice) {
        setAvailableInterfaces([]);
        setSelectedInterface(null);
        return;
      }

      try {
        // Assume your backend route supports a 'device' param to filter interfaces
        const res = await apiClient.get('/telemetry/interface-statistics/interfaces/', {
          params: { device: selectedDevice }
        });

        // res.data.interfaces expected to be an array of interface names (strings)
        const options = res.data.interfaces.map(iface => ({
          value: iface,
          label: iface,
        }));

        setAvailableInterfaces(options);
        // Optionally reset selected interface to first available or null
        setSelectedInterface(options.length > 0 ? options[0] : null);
      } catch (err) {
        console.error('Error fetching interfaces:', err);
        setAvailableInterfaces([]);
        setSelectedInterface(null);
      }
    };

    fetchInterfaces();
  }, [selectedDevice]);

  // Dynamically calculate yDomain based on the selected metric or all metrics
  const yDomain = useMemo(() => {
    if (interfaceStatistics.length === 0) return [0, 'auto']; // Start from 0 for counts

    // Collect all relevant numeric values to determine the domain
    const allValues = interfaceStatistics.flatMap(item => [
      item.ether_state,
      item.oper_status,
    ]).filter(v => typeof v === 'number' && v >= 0); // Ensure values are numbers and non-negative

    if (allValues.length === 0) return [0, 'auto'];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    // Adjust domain to give a little padding, ensuring min is not negative
    return [Math.max(0, Math.floor(min * 0.95)), Math.ceil(max * 1.05)];
  }, [interfaceStatistics]);

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
      <div className="signalRightElementHeader">
        <span style={{ fontSize: '14px', color: 'var(--textColor)', paddingLeft: '10px' }}> {selectedDevice || ''} - BGP Connection Statistics</span>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons" style={{ display: 'flex', gap: '10px' }}>
              <Select
                onChange={(option) => setSelectedInterface(option)}
                options={availableInterfaces}
                placeholder="Select interface"
                styles={{
                  ...customStyles('190px'),
                  menuPortal: base => ({ ...base, zIndex: 9999 }),
                }}
                value={selectedInterface}
                isClearable={true}
                menuPortalTarget={document.body}
                isDisabled={!selectedDevice}
              />
            </div>
          </div>
        )}
      </div>

      {showData && selectedInterface && interfaceStatistics.length > 0 ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%" background="red">
              <LineChart
                data={interfaceStatistics}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="timestamp" reversed={true}/>
                <YAxis domain={yDomain} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ether-state" stroke="#8884d8" dot={false} name="Ether State" />
                <Line type="monotone" dataKey="oper-status" stroke="#ffc658" dot={false} name="Oper Status" />
                {/* Add more lines for other relevant statistics if desired */}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : showData && selectedInterface && interfaceStatistics.length === 0 ? (
        <div className="no-data-message" style={{ padding: '20px', textAlign: 'center' }}>
          No data available for the selected interface.
        </div>
      ) : showData && !selectedInterface ? (
        <div className="no-data-message" style={{ padding: '20px', textAlign: 'center' }}>
          Please select an interface to view statistics.
        </div>
      ) : null}
    </div>
  );
};

export default InterfaceOper;