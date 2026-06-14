import React, { useState, useMemo, useEffect } from "react";
import "../../css/SignalInfo.css";
import kcFetch from "../misc/kcFetch";
import Select from "react-select";
import customStyles from "../misc/SelectStyles";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import moment from "moment";

const InterfaceStats = ({ keycloak, currentUser, selectedDevice }) => {

  const [showData, setShowData] = useState(true);
  const [selectedInterface, setSelectedInterface] = useState(null);
  const [interfaceStatistics, setInterfaceStatistics] = useState([]);
  const [availableInterfaces, setAvailableInterfaces] = useState([]);

  useEffect(() => {
    if (!selectedDevice) {
      setShowData(false);
      setInterfaceStatistics([]);
    } else {
      setShowData(true);
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (availableInterfaces.length > 0 && !selectedInterface) {
      setSelectedInterface(availableInterfaces[0]);
    }
  }, [availableInterfaces, selectedInterface]);

  // Fetch interface statistics
  useEffect(() => {

    const fetchInterfaceStatistics = async () => {

      if (!selectedDevice || !selectedInterface || !keycloak?.authenticated) {
        setInterfaceStatistics([]);
        return;
      }

      try {

        const query = new URLSearchParams({
          device: selectedDevice,
          interface: selectedInterface.value
        }).toString();

        const data = await kcFetch(
          keycloak,
          `/telemetry/interface-statistics/?${query}`
        );

        const formatted = data.results.map(item => ({
          timestamp: moment(item.ingested_at).format("HH:mm:ss"),
          discontinuityTime: item.stats?.["discontinuity-time"] ?? 0,
          inOctets: item.stats?.["in-octets"] ?? 0,
          inUnicastPkts: item.stats?.["in-unicast-pkts"] ?? 0,
          inBroadcastPkts: item.stats?.["in-broadcast-pkts"] ?? 0,
          inMulticastPkts: item.stats?.["in-multicast-pkts"] ?? 0,
          inDiscards: item.stats?.["in-discards"] ?? 0,
          inErrors: item.stats?.["in-errors"] ?? 0,
          inUnknownProtos: item.stats?.["in-unknown-protos"] ?? 0,
          outOctets: item.stats?.["out-octets"] ?? 0,
          outUnicastPkts: item.stats?.["out-unicast-pkts"] ?? 0,
          outBroadcastPkts: item.stats?.["out-broadcast-pkts"] ?? 0,
          outMulticastPkts: item.stats?.["out-multicast-pkts"] ?? 0,
          outDiscards: item.stats?.["out-discards"] ?? 0,
          outErrors: item.stats?.["out-errors"] ?? 0,
          rxPps: item.stats?.["rx-pps"] ?? 0,
          rxKbps: item.stats?.["rx-kbps"] ?? 0,
          txPps: item.stats?.["tx-pps"] ?? 0,
          txKbps: item.stats?.["tx-kbps"] ?? 0,
          numFlaps: item.stats?.["num-flaps"] ?? 0,
          inCrcErrors: item.stats?.["in-crc-errors"] ?? 0,
          inDiscards64: item.stats?.["in-discards-64"] ?? 0,
          inErrors64: item.stats?.["in-errors-64"] ?? 0,
          inUnknownProtos64: item.stats?.["in-unknown-protos-64"] ?? 0,
          outOctets64: item.stats?.["out-octets-64"] ?? 0
        }));

        setInterfaceStatistics(formatted);

      } catch (err) {
        console.error("Error fetching interface statistics:", err);
        setInterfaceStatistics([]);
      }

    };

    fetchInterfaceStatistics();

  }, [selectedDevice, selectedInterface, keycloak]);

  // Fetch interfaces list
  useEffect(() => {

    const fetchInterfaces = async () => {

      if (!selectedDevice || !keycloak?.authenticated) {
        setAvailableInterfaces([]);
        setSelectedInterface(null);
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

        const options = (data.interfaces || []).map(iface => ({
          value: iface,
          label: iface
        }));

        setAvailableInterfaces(options);
        setSelectedInterface(options.length > 0 ? options[0] : null);

      } catch (err) {
        console.error("Error fetching interfaces:", err);
        setAvailableInterfaces([]);
        setSelectedInterface(null);
      }

    };

    fetchInterfaces();

  }, [selectedDevice, keycloak]);

  // Calculate Y-axis domain dynamically
  const yDomain = useMemo(() => {

    if (interfaceStatistics.length === 0) return [0, "auto"];

    const allValues = interfaceStatistics
      .flatMap(item => Object.values(item))
      .filter(v => typeof v === "number" && v >= 0);

    if (allValues.length === 0) return [0, "auto"];

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);

    return [Math.max(0, Math.floor(min * 0.95)), Math.ceil(max * 1.05)];

  }, [interfaceStatistics]);

  return (
    <div className="mainContainer" style={{ maxHeight: '220px', marginBottom: '10px' }}>

      <div > 

        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons" style={{ display: "flex", gap: "10px" }}>
              <Select
                onChange={option => setSelectedInterface(option)}
                options={availableInterfaces}
                placeholder="Select interface"
                styles={{
                  ...customStyles("190px"),
                  menuPortal: base => ({ ...base, zIndex: 9999 })
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

        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px" }}>
          <div style={{ width: "100%", height: 200 }}>

            <ResponsiveContainer width="100%" height="100%">

              <LineChart
                data={interfaceStatistics}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >

                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="timestamp" reversed />
                <YAxis domain={yDomain} />
                <Tooltip />
                <Legend />

                <Line type="monotone" dataKey="inOctets" stroke="#8884d8" dot={false} name="In Octets"/>
                <Line type="monotone" dataKey="outOctets" stroke="#82ca9d" dot={false} name="Out Octets"/>
                <Line type="monotone" dataKey="inUnicastPkts" stroke="#ffc658" dot={false} name="In Unicast Pkts"/>
                <Line type="monotone" dataKey="outUnicastPkts" stroke="#ff7300" dot={false} name="Out Unicast Pkts"/>
                <Line type="monotone" dataKey="inDiscards" stroke="#a83279" dot={false} name="In Discards"/>
                <Line type="monotone" dataKey="outDiscards" stroke="#32a8a4" dot={false} name="Out Discards"/>
                <Line type="monotone" dataKey="inErrors" stroke="#6f42c1" dot={false} name="In Errors"/>
                <Line type="monotone" dataKey="outErrors" stroke="#fd7e14" dot={false} name="Out Errors"/>
                <Line type="monotone" dataKey="rxPps" stroke="#20c997" dot={false} name="Rx PPS"/>
                <Line type="monotone" dataKey="txPps" stroke="#17a2b8" dot={false} name="Tx PPS"/>
                <Line type="monotone" dataKey="rxKbps" stroke="#6c757d" dot={false} name="Rx KBPS"/>
                <Line type="monotone" dataKey="txKbps" stroke="#007bff" dot={false} name="Tx KBPS"/>

              </LineChart>

            </ResponsiveContainer>

          </div>
        </div>

      ) : showData && selectedInterface && interfaceStatistics.length === 0 ? (

        <div className="no-data-message" style={{ padding: "20px", textAlign: "center" }}>
          No data available for the selected interface.
        </div>

      ) : showData && !selectedInterface ? (

        <div className="no-data-message" style={{ padding: "20px", textAlign: "center" }}>
          Please select an interface to view statistics.
        </div>

      ) : null}

    </div>
  );
};

export default InterfaceStats;