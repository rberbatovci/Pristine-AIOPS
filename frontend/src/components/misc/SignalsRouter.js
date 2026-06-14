// pages/SignalsRouter.jsx

import { useParams } from "react-router-dom";

import SyslogSignalsTable from "../signals/SyslogTable";
import SyslogSignalsStatistics from "../signals/SyslogStatistics";

import SnmpTrapSignalsTable from "../signals/SnmpTrapTable";
import SnmpTrapSignalsStatistics from "../signals/SnmpTrapStatistics";

import TelemetryTable from "../signals/TelemetryTable";
import TelemetryStatistics from "../signals/TelemetryStatistics";

export default function SignalsRouter(props) {
  const { type, view } = useParams();

  const isStatistics = view === "statistics";

  switch (type) {
    case "syslogs":
      return isStatistics
        ? <SyslogSignalsStatistics {...props} />
        : <SyslogSignalsTable {...props} />;

    case "snmp-traps":
      return isStatistics
        ? <SnmpTrapSignalsStatistics {...props} />
        : <SnmpTrapSignalsTable {...props} />;

    case "telemetry":
      return isStatistics
        ? <TelemetryStatistics {...props} />
        : <TelemetryTable {...props} />;

    default:
      return <div>Unknown signal type</div>;
  }
}