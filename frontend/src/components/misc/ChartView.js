import { useEffect } from 'react';
import SyslogSignalsStatistics from '../statistics/SyslogSignalsStatistics';
import SyslogEventsStatistics from '../statistics/SyslogEventsStatistics';
import TrapSignalsStatistics from '../statistics/TrapSignalsStatistics';
import TrapEventsStatistics from '../statistics/TrapEventsStatistics';
import NetflowStatistics from '../statistics/TrapEventsStatistics';

const ChartView = ({
  keycloak,
  currentUser,
  source,
  dataSource,
  selectedTags,
}) => {

  useEffect(() => {
    console.log("Selected Tags changed:", selectedTags);
  }, [selectedTags]);

  return (
    <div>
      {dataSource === 'syslogs' && source === 'signals' && (
        <SyslogSignalsStatistics keycloak={keycloak} selectedTags={selectedTags} />
      )}
      {dataSource === 'snmptraps' && source === 'signals' && (
        <TrapSignalsStatistics keycloak={keycloak} selectedTags={selectedTags} />
      )}
      {dataSource === 'syslogs' && source === 'events' && (
        <SyslogEventsStatistics keycloak={keycloak} selectedTags={selectedTags} />
      )}
      {dataSource === 'snmptraps' && source === 'events' && (
        <TrapEventsStatistics keycloak={keycloak} selectedTags={selectedTags} />
      )}
      {dataSource === 'netflow' && (
        <NetflowStatistics keycloak={keycloak} selectedTags={selectedTags} />
      )}
    </div>
  );
};

export default ChartView;
