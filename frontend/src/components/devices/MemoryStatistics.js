import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Grid,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useDeviceStatus } from "../../hooks/useDeviceStatus"; // Preserved custom hook

export default function MemoryStatistics({
  selectedDevice,
  refreshTrigger,
  onDataFetched,
  keycloak, // Preserved Keycloak instance for authenticated API requests
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keep useDeviceStatus active inside the component
  const deviceStatus = useDeviceStatus(selectedDevice?.ip_address);

  const normalizeMemoryData = useCallback(
    (msg) => {
      if (!msg) return null;

      // Unpack stats directly or from dynamic pool keys (e.g. "reserve Processor")
      let stats = msg.stats;
      let poolName = "Main Memory";

      if (!stats) {
        const poolKey = Object.keys(msg).find((key) => msg[key]?.stats);
        if (poolKey) {
          stats = msg[poolKey].stats;
          poolName = poolKey;
        }
      }

      stats = stats || {};

      const totalMemory = Math.max(0, Number(stats["total-memory"] ?? 0));
      const usedMemory = Math.max(0, Number(stats["used-memory"] ?? 0));
      const freeMemory = Math.max(0, Number(stats["free-memory"] ?? 0));

      const calculatedUsage = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;
      const usage = Math.min(
        100,
        Math.max(0, Number(stats["usage"] ?? calculatedUsage))
      );

      return {
        hostname: msg.hostname ?? selectedDevice?.hostname ?? null,
        ip: msg.ip ?? selectedDevice?.ip_address ?? null,
        poolName,
        memory_util: usage,
        stats: {
          "total-memory": totalMemory,
          "used-memory": usedMemory,
          "free-memory": freeMemory,
          usage,
          "used-memory-percent": usage,
          "free-memory-percent": Math.max(0, 100 - usage),
        },
        timestamp: msg.timestamp ?? new Date().toISOString(),
      };
    },
    [selectedDevice?.hostname, selectedDevice?.ip_address]
  );

  const fetchMemoryData = useCallback(async () => {
    if (!selectedDevice?.ip_address) return;

    setLoading(true);
    setError(null);

    try {
      const headers = {};
      if (keycloak?.token) {
        headers["Authorization"] = `Bearer ${keycloak.token}`;
      }

      const response = await fetch(
        `/api/v1/devices/${selectedDevice.ip_address}/memory`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.json();
      const normalized = normalizeMemoryData(rawData);

      setData(normalized);

      // Return normalized stats back to Info.js
      if (onDataFetched) {
        onDataFetched(normalized);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch memory data");
      setData(null);
      if (onDataFetched) {
        onDataFetched(null);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDevice?.ip_address, keycloak?.token, normalizeMemoryData, onDataFetched]);

  useEffect(() => {
    fetchMemoryData();
  }, [fetchMemoryData, refreshTrigger]);

  if (!selectedDevice) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary">
          Select a device to view memory statistics.
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Loading memory statistics...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="error">
          Error loading memory statistics: {error}
        </Typography>
      </Box>
    );
  }

  if (!data || !data.stats) {
    return (
      <Box p={2}>
        <Typography variant="body2" color="text.secondary">
          No memory statistics available.
        </Typography>
      </Box>
    );
  }

  const { stats, poolName } = data;
  const memoryUtil = stats.usage ?? 0;

  const getStatusColor = (value) => {
    if (value >= 85) return "error";
    if (value >= 70) return "warning";
    return "success";
  };

  // Unit conversion handling (Bytes, KB, MB, GB, TB)
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Box p={2} border={1} borderColor="divider" borderRadius={2}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="h6">
            Memory Statistics {poolName && `(${poolName})`}
          </Typography>
          {deviceStatus && (
            <Chip
              label={deviceStatus.status || "Unknown"}
              size="small"
              color={deviceStatus.status === "online" ? "success" : "default"}
              variant="outlined"
            />
          )}
        </Box>
        <Tooltip title="Refresh Memory Stats">
          <IconButton onClick={fetchMemoryData} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box mb={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
          <Typography variant="body2" color="text.secondary">
            Memory Utilization
          </Typography>
          <Chip
            label={`${memoryUtil.toFixed(1)}%`}
            color={getStatusColor(memoryUtil)}
            size="small"
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, Math.max(0, memoryUtil))}
          color={getStatusColor(memoryUtil)}
          sx={{ height: 8, borderRadius: 1 }}
        />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary" display="block">
            Total
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {formatBytes(stats["total-memory"])}
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary" display="block">
            Used
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {formatBytes(stats["used-memory"])}
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption" color="text.secondary" display="block">
            Free
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {formatBytes(stats["free-memory"])}
          </Typography>
        </Grid>
      </Grid>

      {data.timestamp && (
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mt={2}
          textAlign="right"
        >
          Last updated: {new Date(data.timestamp).toLocaleTimeString()}
        </Typography>
      )}
    </Box>
  );
}

MemoryStatistics.propTypes = {
  selectedDevice: PropTypes.shape({
    ip_address: PropTypes.string,
    hostname: PropTypes.string,
  }),
  refreshTrigger: PropTypes.number,
  onDataFetched: PropTypes.func,
  keycloak: PropTypes.object,
};