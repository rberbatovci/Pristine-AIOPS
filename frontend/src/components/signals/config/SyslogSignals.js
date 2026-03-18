import StatefulSyslogs from './StatefulSyslogs';
import SyslogMnemonicUpdater from './SyslogMnemonic';
import SyslogSeverity from './SyslogSeverity';
import './SignalConfigElement.css';
import { useMnemonics } from "../../../hooks/useMnemonics";
import { useDevices } from "../../../hooks/useDevices";

const SyslogSignalsConfig = ({ keycloak }) => {
    const options = [
        { label: 'Syslog Severity', value: 'syslogSeverity' },
        { label: 'Syslog Mnemonic', value: 'syslogMnemonic' },
        { label: 'Stateful Syslogs', value: 'syslogs' },
    ];
    const { mnemonics, loading: mnemonicsLoading } = useMnemonics(keycloak, false);
    const { devices } = useDevices(keycloak, false);

    const contentMap = {
        syslogSeverity: <SyslogSeverity />,
        syslogs: <StatefulSyslogs devices={devices} mnemonics={mnemonics} />,
        syslogMnemonic: <SyslogMnemonicUpdater mnemonics={mnemonics} />,
    };

    return (
        <div className="dropdownConfigContainer">
            <div>
                <SyslogSeverity />
            </div>
            <div><StatefulSyslogs devices={devices} mnemonics={mnemonics} /></div>

        </div>
    );
};

export default SyslogSignalsConfig;
