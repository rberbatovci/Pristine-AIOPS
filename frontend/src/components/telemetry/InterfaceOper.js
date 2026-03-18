import React, { useState, useEffect } from 'react';
import '../../css/SignalInfo.css';
import kcFetch from '../misc/kcFetch';
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

const InterfaceOper = ({ keycloak, currentUser, selectedDevice }) => {

  const [showData, setShowData] = useState(true);
  const [interfaceStatistics, setInterfaceStatistics] = useState([]);
  const [availableInterfaces, setAvailableInterfaces] = useState([]);

  const statusMap = {
    'if-oper-state-ready': 1,
    'if-oper-state-no-pass': 0,
    '': null
  };

  // Handle device change
  useEffect(() => {
    if (!selectedDevice) {
      setShowData(false);
      setInterfaceStatistics([]);
      setAvailableInterfaces([]);
    } else {
      setShowData(true);
    }
  }, [selectedDevice]);

  // Fetch interface statistics
  useEffect(() => {

    const fetchInterfaceStatistics = async () => {

      if (!selectedDevice || !keycloak?.authenticated) return;

      try {

        const query = new URLSearchParams({
          device: selectedDevice
        }).toString();

        const data = await kcFetch(
          keycloak,
          `/telemetry/interface-oper-status/?${query}`
        );

        const grouped = {};

        data.results.forEach(item => {

          const ts = moment(item.ingested_at).format('HH:mm:ss');

          if (!grouped[ts]) {
            grouped[ts] = { timestamp: ts };
          }

          grouped[ts][item.interface] = statusMap[item.status] ?? null;

        });

        const formatted = Object.values(grouped);

        setInterfaceStatistics(formatted);

        console.log('Interface statistics fetched:', formatted);

      } catch (err) {

        console.error('Error fetching interface statistics:', err);
        setInterfaceStatistics([]);

      }
    };

    fetchInterfaceStatistics();

  }, [selectedDevice, keycloak]);

  // Fetch available interfaces
  useEffect(() => {

    const fetchInterfaces = async () => {

      if (!selectedDevice || !keycloak?.authenticated) {
        setAvailableInterfaces([]);
        return;
      }

      try {

        const query = new URLSearchParams({
          device: selectedDevice
        }).toString();

        const data = await kcFetch(
          keycloak,
          `/telemetry/interface-oper-status/interfaces/?${query}`
        );

        const ifaceList = (data.interfaces || []).filter(
          iface => iface && iface.trim() !== ''
        );

        setAvailableInterfaces(ifaceList);

      } catch (err) {

        console.error('Error fetching interfaces:', err);
        setAvailableInterfaces([]);

      }
    };

    fetchInterfaces();

  }, [selectedDevice, keycloak]);

  const formatStatus = (tick) => {

    if (tick === 1) return 'Ready';
    if (tick === 0) return 'No-Pass';

    return '';

  };

  return (

    <div
      className={`signalRightElementContainer ${
        showData ? 'expanded' : 'collapsed'
      }`}
    >

      <div className="signalRightElementHeader">

        <span
          style={{
            fontSize: '14px',
            color: 'var(--textColor)',
            paddingLeft: '10px'
          }}
        >
          {selectedDevice || ''} - Interfaces
        </span>

      </div>

      {showData && interfaceStatistics.length > 0 ? (

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '10px'
          }}
        >

          <div style={{ width: '100%', height: 200 }}>

            <ResponsiveContainer width="100%" height="100%">

              <LineChart
                data={interfaceStatistics}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >

                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />

                <XAxis
                  dataKey="timestamp"
                  reversed={true}
                />

                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={formatStatus}
                />

                <Tooltip
                  formatter={(value) =>
                    value === 1 ? 'Ready' : 'No-Pass'
                  }
                />

                <Legend />

                {availableInterfaces.map((iface, idx) => (

                  <Line
                    key={iface}
                    type="monotone"
                    dataKey={iface}
                    stroke={[
                      '#8884d8',
                      '#82ca9d',
                      '#ff7300',
                      '#0088FE',
                      '#00C49F'
                    ][idx % 5]}
                    dot={false}
                    connectNulls={true}
                  />

                ))}

              </LineChart>

            </ResponsiveContainer>

          </div>

        </div>

      ) : showData && interfaceStatistics.length === 0 ? (

        <div
          className="no-data-message"
          style={{
            padding: '20px',
            textAlign: 'center'
          }}
        >
          No data available for this device.
        </div>

      ) : null}

    </div>

  );

};

export default InterfaceOper;