import React from 'react';
import SyslogSignalsStatistics from '../statistics/SyslogSignalsStatistics';
import SyslogEventsStatistics from '../statistics/SyslogEventsStatistics';
import TrapSignalsStatistics from '../statistics/TrapSignalsStatistics';
import TrapEventsStatistics from '../statistics/TrapEventsStatistics';

const ChartView = ({
  currentUser,
  dataSource,
  selSignalsTags,
  selEventsTags,
}) => {
  return (
    <div>
      <div>
        {dataSource === 'syslogs' && (
          <SyslogSignalsStatistics selSignalsTags={selSignalsTags} />
        )}
        {dataSource === 'snmptraps' && (
          <TrapSignalsStatistics selSignalsTags={selSignalsTags} />
        )}
      </div>

      <div>
        {dataSource === 'syslogs' && (
          <SyslogEventsStatistics selEventsTags={selEventsTags} />
        )}
        {dataSource === 'snmptraps' && (
          <TrapEventsStatistics selEventsTags={selEventsTags} />
        )}
      </div>
    </div>
  );
};

export default ChartView;
