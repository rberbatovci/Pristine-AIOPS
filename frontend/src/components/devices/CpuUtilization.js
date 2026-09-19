import { useEffect, useRef, useCallback } from "react";
import useDeviceStatus from "../../hooks/useDeviceStatus";

function CpuUtilization({ selectedDevice, keycloak, onCpuUpdate }) {
    const socketRef = useRef(null);
    const { data: initialCpu } = useDeviceStatus(keycloak, selectedDevice, "cpu");
    const normalizeCpuData = useCallback(
        (msg) => {
            if (!msg) { return null; }
            const stats = msg.stats || {};
            const fiveMinutes = Math.min(100, Math.max(0, Number(stats["five-minutes"] ?? 0)));
            const oneMinute = Math.min(100, Math.max(0, Number(stats["one-minute"] ?? 0)));
            const fiveSeconds = Math.min(100, Math.max(0, Number(stats["five-seconds"] ?? 0)));
            const cpuUtil = fiveSeconds;
            return {
                hostname: msg.hostname ?? selectedDevice?.hostname ?? null,
                ip: msg.ip ?? selectedDevice?.ip_address ?? null,
                cpu_util: cpuUtil,
                stats: { "five-minutes": fiveMinutes, "one-minute": oneMinute, "five-seconds": fiveSeconds },
                timestamp: msg.timestamp ?? new Date().toISOString()
            };
        },
        [selectedDevice?.hostname, selectedDevice?.ip_address]
    );

    const handleCpuUpdate = useCallback(
        (msg) => {
            const normalized = normalizeCpuData(msg);
            if (!normalized) { return; }
            console.log("📊 CPU update:", normalized);
            if (onCpuUpdate) { onCpuUpdate(normalized); }
        }, [normalizeCpuData, onCpuUpdate]
    );

    useEffect(() => {
        if (!initialCpu) { return; }
        console.log("📥 Initial CPU data:", initialCpu);
        handleCpuUpdate(initialCpu);
    }, [initialCpu, handleCpuUpdate]);

    useEffect(() => {
        if (!selectedDevice?.hostname) { return; }
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        const wsUrl = `${protocol}://${window.location.host}` + `/ws/cpu?device=${encodeURIComponent(selectedDevice.hostname)}`;
        console.log("🔌 Connecting CPU WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;
        ws.onopen = () => { console.log("✅ CPU WebSocket connected:", selectedDevice.hostname); };
        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                console.log("📡 CPU WebSocket message:", msg);
                if (msg?.type !== "cpu-util") { return; }
                handleCpuUpdate(msg);
            } catch (err) {
                console.error("❌ CPU WebSocket JSON error:", err);
            }
        };
        ws.onerror = (event) => { console.error("❌ CPU WebSocket error:", event); };
        ws.onclose = () => { console.log("🔌 CPU WebSocket disconnected:", selectedDevice.hostname); };

        return () => {
            console.log("🧹 Closing CPU WebSocket:", selectedDevice.hostname);
            ws.close();
            if (
                socketRef.current === ws
            ) {
                socketRef.current = null;
            } 
        };

    }, [ selectedDevice?.hostname, handleCpuUpdate ]);
 
    return null;
}


export default CpuUtilization;