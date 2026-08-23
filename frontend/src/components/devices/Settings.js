import { useState } from "react";
import "../../css/DeviceSettingsModern.css";  
import {
    PiTerminalDuotone,
    PiPulseDuotone, 
    PiShieldCheckeredDuotone,
    PiTreeStructureDuotone,
    PiShareNetworkDuotone,
    PiSlidersHorizontalDuotone,
    PiSpinnerGapDuotone
} from "react-icons/pi"; 
import { RiDeleteBin6Line, RiCloseLine } from "react-icons/ri"; 
import kcFetch from "../misc/kcFetch";

const DeviceSettings = ({
    selectedDevice,
    onConfig,
    onDeviceDelete,
    onDeviceDeselect,
    showNotification,
    keycloak
}) => {
    const [loadingFeature, setLoadingFeature] = useState(null);

    const deselectDevice = () => {
        onDeviceDeselect(true);
    };

    const deleteDevice = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedDevice?.hostname}?`)) {
            return;
        }

        try {
            await kcFetch(
                keycloak,
                `/devices/${selectedDevice.hostname}`,
                { method: "DELETE" }
            );

            onDeviceDeselect(true);
            onDeviceDelete(selectedDevice.id);
            showNotification("Device deleted successfully", "success");
        } catch (err) {
            if (err.status === 403) {
                showNotification("You are not authorized to delete devices", "error");
            } else {
                showNotification("Failed to delete device", "error");
            }
        }
    };

    const pushConfiguration = (featureName) => async () => {
        if (!selectedDevice?.hostname) {
            showNotification("No device selected", "error");
            return;
        } 
        const messages = {
            syslogs: { loading: `Configuring syslogs on ${selectedDevice.hostname}...` },
            snmp_traps: { loading: `Configuring SNMP Traps on ${selectedDevice.hostname}...` },
            netflow: { loading: `Configuring Netflow/IPFIX on ${selectedDevice.hostname}...` },
            telemetry: { loading: `Configuring Telemetry on ${selectedDevice.hostname}...` },
            "bgp-link-state": { loading: `Configuring BGP Link State on ${selectedDevice.hostname}...` },
            "aaa-radius": { loading: `Configuring AAA RADIUS on ${selectedDevice.hostname}...` }
        }; 
        const msg = messages[featureName];
        showNotification(msg.loading, "loading");
        setLoadingFeature(featureName); 
        try {
            await kcFetch(
                keycloak,
                `/devices/${selectedDevice.hostname}/configure/${featureName}/`,
                { method: "POST" }
            );
            showNotification("Configuration applied successfully", "success");
            onConfig?.();
        } catch (err) {
            if (err.status === 403) {
                showNotification("You are not authorized to configure devices", "error");
            } else {
                showNotification("Configuration failed", "error");
            }
        } finally {
            setLoadingFeature(null);
        }
    };
 
    const features = [
        { id: "syslogs", label: "Syslogs", icon: <PiTerminalDuotone />, active: selectedDevice?.features?.syslogs },
        { id: "snmp_traps", label: "SNMP Traps", icon: <PiShareNetworkDuotone />, active: selectedDevice?.features?.snmp_traps },
        { id: "netflow", label: "Netflow / IPFIX", icon: <PiPulseDuotone />, active: selectedDevice?.features?.netflow },
        { id: "telemetry", label: "Telemetry", icon: <PiSlidersHorizontalDuotone />, active: selectedDevice?.features?.telemetry?.enabled },
        { id: "bgp-link-state", label: "BGP Link State", icon: <PiTreeStructureDuotone />, active: selectedDevice?.features?.["bgp-link-state"] },
        { id: "aaa-radius", label: "AAA RADIUS", icon: <PiShieldCheckeredDuotone />, active: selectedDevice?.features?.["aaa-radius"] },
    ];

    return (
        <div className="settings-panel" style={{ width: '100%', maxWidth: '580px' }}> 
            <div className="settings-header">
                <h3>Device Control Center</h3>
                <p>{selectedDevice?.hostname || "Unknown Device"}</p>
            </div>  
            <div className="features-grid">
                {features.map((feature) => (
                    <button
                        key={feature.id}
                        className={`feature-card ${feature.active ? "active" : ""} ${loadingFeature === feature.id ? "loading" : ""}`}
                        onClick={pushConfiguration(feature.id)}
                        disabled={loadingFeature !== null} >
                        <div className="feature-icon-wrapper">
                            {loadingFeature === feature.id ? (
                                <PiSpinnerGapDuotone className="spin-animation" />
                            ) : (
                                feature.icon
                            )}
                        </div>
                        <div className="feature-info">
                            <span className="feature-label">{feature.label}</span>
                            <span className="feature-status">
                                {feature.active ? "Active" : "Not Configured"}
                            </span>
                        </div>
                    </button>
                ))}
            </div> 
            <div className="settings-footer">
                <button className="footer-btn delete-btn" onClick={deleteDevice}>
                    <RiDeleteBin6Line />
                    <span>Delete Device</span>
                </button>
                <button className="footer-btn close-btn" onClick={deselectDevice}>
                    <RiCloseLine />
                    <span>Close Panel</span>
                </button>
            </div>
        </div>
    );
};

export default DeviceSettings;