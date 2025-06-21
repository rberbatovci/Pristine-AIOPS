import React, { useState } from 'react';
import apiClient from '../misc/AxiosConfig';

import DeviceInfo from './DeviceInfo';
import SyslogConfig from './SyslogConfig';
import SnmpTrapConfig from './SnmpTrapConfig';
import NetflowConfig from './NetflowConfig';
import TelemetryConfig from './TelemetryConfig';

const STEPS = {
    DEVICE: 0,
    SYSLOG: 1,
    SNMP: 2,
    NETFLOW: 3,
    TELEMETRY: 4,
    DONE: 5,
};

function AddNewDevice({ onDeviceAdded }) {
    const [step, setStep] = useState(STEPS.DEVICE);
    const [deviceIdentifier, setDeviceIdentifier] = useState(null); // hostname or id
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleDeviceSubmit = async (data) => {
        try {
            const res = await apiClient.post('/devices/', {
                ...data,
                vendor: data.vendor.value,
                version: data.version?.value || null,
            });
            setDeviceIdentifier(res.data.hostname);
            setStep(STEPS.SYSLOG);
        } catch (err) {
            setError('Failed to add device.');
        }
    };

    const renderStep = () => {
        switch (step) {
            case STEPS.DEVICE:
                return <DeviceInfo onSubmit={handleDeviceSubmit} onSuccess={() => setStep(STEPS.SYSLOG)} />;
            case STEPS.SYSLOG:
                return <SyslogConfig hostname={deviceIdentifier} onSuccess={() => setStep(STEPS.SNMP)} />;
            case STEPS.SNMP:
                return <SnmpTrapConfig hostname={deviceIdentifier} onSuccess={() => setStep(STEPS.NETFLOW)}  />;
            case STEPS.NETFLOW:
                return <NetflowConfig hostname={deviceIdentifier} onSuccess={() => setStep(STEPS.TELEMETRY)}  />;
            case STEPS.TELEMETRY:
                return <TelemetryConfig hostname={deviceIdentifier} onSuccess={() => setStep(STEPS.DONE)}  />;
            case STEPS.DONE:
                return (
                    <div>
                        <p style={{ color: 'var(--successColor)' }}>Device configuration complete!</p>
                        <button onClick={() => {
                            setStep(STEPS.DEVICE);
                            setDeviceIdentifier(null);
                            setSuccess(false);
                        }}>Add Another</button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="add-new-device-form">
            {error && <p className="error-message">{error}</p>}
            {renderStep()}
        </div>
    );
}

export default AddNewDevice;
