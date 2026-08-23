import { useState, useEffect } from 'react'; 
import { PiWarningCircleDuotone, PiInfoDuotone } from 'react-icons/pi';
import kcFetch from '../misc/kcFetch';
import '../../css/Devices.css'; 

function CpuUtilization({ keycloak, selectedDevice, showNotification }) {

    return (
        <div className="device-info-panel"> 
            <div className="info-header">
                <div className="header-title">
                    <PiInfoDuotone style={{ color: 'var(--textColor)', fontSize: '18px' }} />
                    <h2 style={{ color: 'var(--textColor)', fontSize: '14px' }}>Device Warning</h2>
                </div>
            </div> 
             <div className="info-grid-content"> 
                <div className="device-warning-banner">
                    <PiWarningCircleDuotone className="warning-icon" />
                    <p>This is a discovered device. Please onboard it to enable advanced features.</p>
                </div>

            </div>

        </div>
    );
}

export default CpuUtilization;