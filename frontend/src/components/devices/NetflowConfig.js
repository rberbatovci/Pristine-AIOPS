import { useState } from 'react';
import apiClient from '../misc/AxiosConfig';
import { TailSpin } from 'react-loader-spinner';
import { IoPushOutline, IoPushSharp } from "react-icons/io5";

function NetflowConfig({ selectedDevice: initialDevice, onSuccess }) {
    const [device, setDevice] = useState(initialDevice);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const getNetflowEndpoint = () => {
        if (!device.version) throw new Error('Device version not provided');
        if (device.version === 'ios-xe') return `/devices/${device.hostname}/netflow-xe-config/`;
        if (device.version === 'ios-xr') return `/devices/${device.hostname}/netflow-xr-config/`;
        throw new Error(`Unsupported device version: ${device.version}`);
    };

    const sendConfig = async () => {

        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post(getNetflowEndpoint(), {});

            setDevice(prev => ({
                ...prev,
                features: { ...prev.features, netflow: true }
            }));

            if (onSuccess) onSuccess(response.data);
        } catch (err) {
            console.error('Netflow config failed:', err);
            setError(err.response?.data?.detail || err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="signalRightElementContainer">
            <div className="signalRightElementHeader">
                <h2 className="signalRightElementHeaderTxt" >
                    Netflow
                </h2>
                {!device?.features?.netflow && (
                    <div className="zoom-buttons-container">
                        <div className="headerButtons">

                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <TailSpin
                                        height="20"
                                        width="20"
                                        color="#ffffff"
                                        ariaLabel="loading"
                                    />
                                </div>
                            ) : (
                                <button onClick={sendConfig} className="iconButton">
                                    <IoPushOutline className="defaultIcon" />
                                    <IoPushSharp className="hoverIcon" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            <div style={{ padding: '8px', marginLeft: '15px', fontSize: '14px', color: 'var(--textColor)', opacity: '0.8' }}>
                {loading ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Configuring Netflow<span className="dot-flash">...</span>
                    </div>
                ) : device?.features?.netflow ? (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Netflow are already configured on this device.
                    </div>
                ) : (
                    <div style={{ color: 'var(--spanTextColor)' }}>
                        Please configure Netflow on the device.
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div style={{ color: 'red', marginTop: '10px' }}>
                        {typeof error === 'string' ? error : JSON.stringify(error)}
                    </div>
                )}
            </div>
        </div>
    );
}

export default NetflowConfig;
