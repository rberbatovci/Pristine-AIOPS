import React, { useState, useEffect, useCallback } from "react";
import {
  PiInfoDuotone,
  PiXBold,
  PiMagnifyingGlassBold,
  PiSpinnerGapBold,
  PiPulseBold,
  PiCpuBold,
  PiMemoryBold,
  PiWarningCircleBold,
  PiBroadcastBold
} from "react-icons/pi";

import "../../css/SignalInfoModern.css";
import useDeviceDeepScan from "../../hooks/useDeviceDeepScan";
import CpuUtilization from "./CpuUtilization";
import MemoryStatistics from "./MemoryStatistics";

// MetricBar moved outside the component to prevent re-creation on every render
const MetricBar = ({ label, value, status, icon }) => (
  <div className="metric-card">
    <div className="metric-header">
      <div className="metric-title">
        {icon} <span>{label}</span>
      </div>
      <div className={`metric-value ${status.className}`}>
        {Math.round(value)}%
      </div>
    </div>
    <div className="metric-bar-container">
      <div
        className={`metric-bar-fill ${status.className}`}
        style={{ width: `${value}%` }}
      />
    </div>
    <div className="metric-footer">
      <span>{status.text}</span>
      <span>0% — 100%</span>
    </div>
  </div>
);

const Info = ({ selectedDevice, onDeviceDeselect, keycloak, pingData, telemetryData }) => {
  // 1. ALL HOOKS DECLARED AT THE TOP LEVEL (BEFORE ANY EARLY RETURN)
  const { loading, scanResult, error, deepScanDevice, setScanResult } = useDeviceDeepScan(keycloak);
  const [cpuData, setCpuData] = useState(null);
  const [memoryData, setMemoryData] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setScanResult(null);
    setCpuData(null);
    setMemoryData(null);
  }, [selectedDevice?.ip_address, setScanResult]);

  const handleMemoryDataFetched = useCallback((data) => {
    setMemoryData(data);
  }, []);

  // 2. EARLY RETURN AFTER ALL HOOKS
  if (!selectedDevice) return null;

  // Deriving real active signal indicators from telemetryData / props
  const signalsData = {
    syslogActive: Boolean(telemetryData?.syslog_active || selectedDevice?.features?.telemetry?.syslog_active),
    syslogCount: Number(telemetryData?.syslog_count || selectedDevice?.features?.telemetry?.syslog_count || 0),
    snmpTrapActive: Boolean(telemetryData?.snmp_trap_active || selectedDevice?.features?.telemetry?.snmp_trap_active),
    snmpTrapCount: Number(telemetryData?.snmp_trap_count || selectedDevice?.features?.telemetry?.snmp_trap_count || 0),
    telemetryActive: Boolean(telemetryData?.gnmi_active || selectedDevice?.features?.telemetry?.gnmi_active),
  };

  const activeOsMatch = scanResult?.os_match || selectedDevice.os_match;
  const activeProtocols = scanResult?.protocols?.tcp || selectedDevice.protocols?.tcp || [];
  const currentPing = pingData || null;
  const pingStatus = (currentPing?.status || "unknown").toLowerCase();
  const pingRtt = typeof currentPing?.rtt_ms === "number" ? currentPing.rtt_ms : null;

  const cpuValue = Number(
    cpuData?.cpu_util ??
    telemetryData?.cpu_util ??
    selectedDevice.features?.telemetry?.cpu_util ??
    0
  );

  const memoryValue = Number(
    memoryData?.memory_util ??
    telemetryData?.memory_util ??
    selectedDevice.features?.telemetry?.memory_util ??
    0
  );

  const cpu = Math.min(100, Math.max(0, cpuValue));
  const memory = Math.min(100, Math.max(0, memoryValue));

  const getUtilizationStatus = (value) => {
    if (value >= 85) return { text: "CRITICAL", className: "critical" };
    if (value >= 65) return { text: "WARNING", className: "warning" };
    return { text: "NORMAL", className: "healthy" };
  };

  const getOverallHealth = () => {
    if (pingStatus === "down") return { text: "DOWN", className: "critical" };
    if (pingStatus === "unknown") return { text: "UNKNOWN", className: "unknown" };
    if (cpu >= 85 || memory >= 85) return { text: "CRITICAL", className: "critical" };
    if (cpu >= 65 || memory >= 65) return { text: "WARNING", className: "warning" };
    return { text: "HEALTHY", className: "healthy" };
  };

  const health = getOverallHealth();
  const cpuStatus = getUtilizationStatus(cpu);
  const memoryStatus = getUtilizationStatus(memory);

  const handleRunDeepScan = async () => {
    if (!selectedDevice.ip_address) return;
    try {
      await deepScanDevice(selectedDevice.ip_address);
    } catch (err) {
      console.error("Deep scan execution error:", err);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "No data";
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="device-info-panel">
      {/* HEADER */}
      <div className="info-header">
        <div className="header-title">
          <div className="header-icon">
            <PiInfoDuotone />
          </div>
          <div className="header-heading">
            <h2>Node Specifications</h2>
            <span className="hostname-subtitle">
              {selectedDevice?.hostname || "Unknown Host"}
            </span>
          </div>
        </div>

        <div className="header-actions">
          <button
            onClick={handleRunDeepScan}
            disabled={loading}
            className={`deep-scan-btn ${loading ? "scanning" : ""}`}
            title="Run Deep Device Scan"
          >
            {loading ? (
              <PiSpinnerGapBold className="spinner-icon" />
            ) : (
              <PiMagnifyingGlassBold />
            )}
            <span>{loading ? "Scanning..." : "Deep Scan"}</span>
          </button>

          <button
            onClick={onDeviceDeselect}
            className="info-close-btn"
            title="Dismiss selection"
          >
            <PiXBold />
          </button>
        </div>
      </div>

      {/* SCAN ERROR */}
      {error && (
        <div className="scan-error-banner">
          <PiWarningCircleBold />
          <span>{error}</span>
        </div>
      )}

      <div className="info-grid-content">
        {/* SIMPLIFIED DEVICE META STRIP */}
        <div className="device-meta-strip">
          <div className="meta-item primary">
            <span className="meta-label">HOST</span>
            <span className="meta-value" title={selectedDevice?.hostname}>
              {selectedDevice?.hostname || "N/A"}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">IP</span>
            <span className="meta-value monospace-data">
              {selectedDevice?.ip_address || "N/A"}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">VENDOR</span>
            <span className="meta-value">
              {selectedDevice?.vendor || "Unknown"}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-label">VERSION</span>
            <span className="meta-value" title={selectedDevice?.version}>
              {selectedDevice?.version || "Unknown"}
            </span>
          </div>
        </div>

        {/* COMPACT HEALTH & PING STRIP */}
        <div className="compact-health-strip">
          <div className={`status-pill ${health?.className || ""}`}>
            <span className="status-indicator-dot" />
            <span className="health-text">{health?.text || "Unknown"}</span>
          </div>

          <div className="ping-detail">
            <PiPulseBold className="ping-icon" />
            <span className="ping-label">STATUS</span>
            <strong>
              {pingStatus === "up"
                ? "Reachable"
                : pingStatus === "down"
                  ? "Unreachable"
                  : "No data"}
            </strong>
          </div>

          {pingRtt !== null && pingRtt !== undefined && (
            <div className="ping-detail">
              <span className="ping-label">RTT</span>
              <strong className="monospace-data">{pingRtt} ms</strong>
            </div>
          )}

          <div className="ping-detail last-check">
            <span className="ping-label">CHECKED</span>
            <span className="timestamp monospace-data">
              {formatTimestamp(currentPing?.timestamp)}
            </span>
          </div>
        </div>

        {/* TELEMETRY & ALARM SIGNALS STRIP */}
        <div className="signals-tab-strip">
          <div className="signals-header-label">
            <PiBroadcastBold className="signals-main-icon" />
            <span>ACTIVE SIGNALS</span>
          </div>

          <div className="signals-grid">
            {/* SYSLOG SIGNAL */}
            <div
              className={`signal-card ${signalsData.syslogActive ? "active syslog-active" : "idle"
                }`}
            >
              <div className="signal-indicator">
                <span className="signal-dot" />
              </div>
              <div className="signal-info">
                <span className="signal-title">SYSLOG</span>
                <span className="signal-count monospace-data">
                  {signalsData.syslogCount ? `${signalsData.syslogCount} msg/s` : "Idle"}
                </span>
              </div>
            </div>

            {/* SNMP TRAP SIGNAL */}
            <div
              className={`signal-card ${signalsData.snmpTrapActive ? "active trap-active" : "idle"
                }`}
            >
              <div className="signal-indicator">
                <span className="signal-dot" />
              </div>
              <div className="signal-info">
                <span className="signal-title">SNMP TRAP</span>
                <span className="signal-count monospace-data">
                  {signalsData.snmpTrapCount ? `${signalsData.snmpTrapCount} events` : "Idle"}
                </span>
              </div>
            </div>

            {/* STREAMING TELEMETRY SIGNAL */}
            <div
              className={`signal-card ${signalsData.telemetryActive ? "active telemetry-active" : "idle"
                }`}
            >
              <div className="signal-indicator">
                <span className="signal-dot" />
              </div>
              <div className="signal-info">
                <span className="signal-title">TELEMETRY</span>
                <span className="signal-count monospace-data">
                  {signalsData.telemetryActive ? "Streaming" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURED & DETAILED TELEMETRY (CPU & MEMORY) */}
        <div className="telemetry-featured-container">
          {/* CPU RESOURCE */}
          <div className="featured-resource-row">
            <div className="resource-brand">
              <div className="resource-icon-box cpu-glow">
                <PiCpuBold />
              </div>
              <div className="resource-info">
                <span className="resource-title">CPU UTILIZATION</span>
                <span className={`resource-status-tag ${cpuStatus?.className || ""}`}>
                  {cpuStatus?.className === "critical"
                    ? "High Load"
                    : cpuStatus?.className === "warning"
                      ? "Elevated"
                      : "Optimal"}
                </span>
              </div>
            </div>

            <div className="resource-track-wrapper">
              <div className="resource-track">
                <div
                  className={`resource-fill-bar cpu-bar ${cpuStatus?.className || ""}`}
                  style={{
                    width: `${Math.min(Math.max(Number(cpu) || 0, 0), 100)}%`
                  }}
                >
                  <span className="bar-pulse-effect" />
                </div>
              </div>
            </div>

            <div className="resource-metric-value">
              <strong className="monospace-data">
                {cpu !== null && cpu !== undefined ? `${cpu}%` : "--"}
              </strong>
            </div>
          </div>

          {/* MEMORY RESOURCE */}
          <div className="featured-resource-row">
            <div className="resource-brand">
              <div className="resource-icon-box memory-glow">
                <PiMemoryBold />
              </div>
              <div className="resource-info">
                <span className="resource-title">MEMORY ALLOCATION</span>
                <span className={`resource-status-tag ${memoryStatus?.className || ""}`}>
                  {memoryStatus?.className === "critical"
                    ? "High Load"
                    : memoryStatus?.className === "warning"
                      ? "Elevated"
                      : "Optimal"}
                </span>
              </div>
            </div>

            <div className="resource-track-wrapper">
              <div className="resource-track">
                <div
                  className={`resource-fill-bar memory-bar ${memoryStatus?.className || ""}`}
                  style={{
                    width: `${Math.min(Math.max(Number(memory) || 0, 0), 100)}%`
                  }}
                >
                  <span className="bar-pulse-effect" />
                </div>
              </div>
            </div>

            <div className="resource-metric-value">
              <strong className="monospace-data">
                {memory !== null && memory !== undefined ? `${memory}%` : "--"}
              </strong>
            </div>
          </div>
        </div>

        {/* DATA LISTENERS */}
        <div className="telemetry-data-source">
          <CpuUtilization
            selectedDevice={selectedDevice}
            keycloak={keycloak}
            onCpuUpdate={setCpuData}
          />
          <MemoryStatistics
            selectedDevice={selectedDevice}
            refreshTrigger={refreshTrigger}
            onDataFetched={handleMemoryDataFetched}
            keycloak={keycloak}
          />
        </div>

        {/* TCP SERVICES */}
        {activeProtocols?.length > 0 && (
          <div className="section-card tcp-services-card">
            <div className="section-heading">
              <div>
                <span className="section-kicker">DEEP SCAN</span>
                <span className="section-title">TCP Services</span>
              </div>
              <span className="service-count">
                {activeProtocols.length} detected
              </span>
            </div>

            <div className="protocols-list">
              {activeProtocols.map((service, index) => (
                <div key={service.port || index} className="protocol-row">
                  <div className="protocol-port">{service.port}</div>

                  <div className="protocol-details">
                    <div className="protocol-name">
                      {service.name?.toUpperCase() || "UNKNOWN"}
                    </div>
                    <div className="protocol-product">
                      {service.product || "Unknown Service"}
                      {service.version ? ` ${service.version}` : ""}
                    </div>
                  </div>

                  <span className={`protocol-state ${service.state || ""}`}>
                    {service.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Info;