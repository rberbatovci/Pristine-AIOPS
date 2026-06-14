// pages/EventsRouter.jsx

import { useParams } from "react-router-dom";

import SyslogEventsTable from "../syslogs/EventsTable";
import SyslogEventsStatistics from "../syslogs/EventsStatistics";

import SnmpTrapEventsTable from "../snmptraps/EventsTable";
import SnmpTrapEventsStatistics from "../snmptraps/EventsStatistics";

export default function EventsRouter(props) {
  const { type, view } = useParams();

  const isStatistics = view === "statistics";

  switch (type) {
    case "syslogs":
      return isStatistics
        ? <SyslogEventsStatistics {...props} />
        : <SyslogEventsTable {...props} />;

    case "snmp-traps":
      return isStatistics
        ? <SnmpTrapEventsStatistics {...props} />
        : <SnmpTrapEventsTable {...props} />;

    default:
      return <div>Unknown event type</div>;
  }
}