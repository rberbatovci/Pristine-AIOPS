import React, { useState } from 'react';
import '../App.css';
import '../css/SyslogDatabase.css';
import SyslogSignalsStatistics from '../components/statistics/SyslogSignalsStatistics.js';
import TrapSignalsStatistics from '../components/statistics/TrapSignalsStatistics.js';
import SyslogStatistics from '../components/statistics/SyslogStatistics.js';
import SNMPTrapStatistics from '../components/statistics/SNMPTrapStatistics.js';
import { MdBookmarkBorder, MdBookmark } from "react-icons/md";
import { FaClock, FaRegClock } from "react-icons/fa";
import SearchTime from '../components/misc/SearchTime.js';
import SyslogComponents from '../components/statistics/SyslogComponents.js';
import TrapComponents from '../components/statistics/TrapComponents.js';
import SyslogSignalsComponents from '../components/statistics/SyslogSignalsComponents.js';
import TrapSignalsComponents from '../components/statistics/TrapSignalsComponents.js';

function Statistics() {
  const [dataSource, setDataSource] = useState('syslogSignals'); // default view

  const [dropdowns, setDropdowns] = useState({
    components: { visible: false, position: { x: 0, y: 0 } },
    time: { visible: false, position: { x: 0, y: 0 } }
  });

  const handleHeaderClick = (source) => {
    setDataSource(source);
  };

  const handleButtonClick = (event, dropdownKey) => {
    const updatedDropdowns = Object.keys(dropdowns).reduce((acc, key) => {
      acc[key] = { ...dropdowns[key], visible: false };
      return acc;
    }, {});
    const newVisibility = !dropdowns[dropdownKey].visible;
    setDropdowns({
      ...updatedDropdowns,
      [dropdownKey]: {
        ...dropdowns[dropdownKey],
        visible: newVisibility,
      },
    });
  };

  return (
    <div className="mainContainer">
      <div className="mainContainerHeader">
        <div className="headerTitles">
          <h2 className="mainContainerTitle">Statistics Dashboard</h2>
          <h2
            className={`eventsTitleHeader ${dataSource === 'syslogSignals' ? 'eventsTitleHeaderActive' : ''}`}
            onClick={() => handleHeaderClick('syslogSignals')}
          >
            Syslog Signals
          </h2>
          <h2
            className={`eventsTitleHeader ${dataSource === 'trapSignals' ? 'eventsTitleHeaderActive' : ''}`}
            onClick={() => handleHeaderClick('trapSignals')}
          >
            SNMP Traps Signals
          </h2>
          <h2
            className={`eventsTitleHeader ${dataSource === 'syslogs' ? 'eventsTitleHeaderActive' : ''}`}
            onClick={() => handleHeaderClick('syslogs')}
          >
            Syslogs
          </h2>
          <h2
            className={`eventsTitleHeader ${dataSource === 'snmptraps' ? 'eventsTitleHeaderActive' : ''}`}
            onClick={() => handleHeaderClick('snmptraps')}
          >
            SNMP Traps
          </h2>
        </div>
        <div className="mainContainerButtons">
          <button
            className="iconButton"
            onClick={(event) => handleButtonClick(event, 'components')}
          >
            <MdBookmarkBorder className="defaultIcon hasFilters" />
            <MdBookmark className="hoverIcon" />
          </button>
          <button
            className="iconButton"
            onClick={(event) => handleButtonClick(event, 'time')}
          >
            <FaRegClock className="defaultIcon hasFilters" />
            <FaClock className="hoverIcon" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around' }}>
        {dataSource === 'syslogSignals' && <SyslogSignalsStatistics />}
        {dataSource === 'trapSignals' && <TrapSignalsStatistics />}
        {dataSource === 'syslogs' && <SyslogStatistics />}
        {dataSource === 'snmptraps' && <SNMPTrapStatistics />}
      </div>

      <div className="dropdownsContainer">
        {dataSource === 'syslogSignals' && (
          <div
            className={`dropdownMenu ${dropdowns.components.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <SyslogSignalsComponents />
          </div>

        )}
        {dataSource === 'trapSignals' && (
          <div
            className={`dropdownMenu ${dropdowns.components.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <TrapSignalsComponents />
          </div>
          
        )}
        {dataSource === 'syslogs' && (
          <div
            className={`dropdownMenu ${dropdowns.components.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <SyslogComponents  />
          </div>
          
        )}
        {dataSource === 'snmptraps' && (
          <div
            className={`dropdownMenu ${dropdowns.components.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <TrapComponents  />
          </div>
          
        )}
        <div
            className={`dropdownMenu ${dropdowns.time.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <SearchTime  />
          </div>
      </div>
    </div>
  );
}

export default Statistics;
