import React, { useState, useEffect } from 'react';
import '../App.css';
import '../css/SyslogDatabase.css';
import SyslogSignalsStatistics from '../components/statistics/SyslogSignalsStatistics.js';
import TrapSignalsStatistics from '../components/statistics/TrapSignalsStatistics.js';
import SyslogEventsStatistics from '../components/statistics/SyslogEventsStatistics.js';
import TrapEventsStatistics from '../components/statistics/TrapEventsStatistics.js';
import { MdBookmarkBorder, MdBookmark } from "react-icons/md";
import { FaClock, FaRegClock } from "react-icons/fa";
import SearchTime from '../components/misc/SearchTime.js';
import SyslogEventsTags from '../components/statistics/SyslogEventsTags.js';
import SyslogSignalsTags from '../components/statistics/SyslogSignalsTags.js'
import TrapEventsTags from '../components/statistics/TrapEventsTags.js';
import TrapSignalsTags from '../components/statistics/TrapSignalsTags.js';
import { PiAlignTopSimpleDuotone, PiAlignTopSimpleFill, PiAlignBottomSimpleDuotone, PiAlignBottomSimpleFill } from "react-icons/pi";

function Statistics({ setDashboardTitle }) {
  const [dataSource, setDataSource] = useState('syslogs'); // default view
  const [selectedTags, setSelectedTags] = useState([]);
  const [selSyslogEventsTags, setSelSyslogEventsTags] = useState([]);
  const [selTrapEventsTags, setSelTrapEventsTags] = useState([]);
  const [selSyslogSignalsTags, setSelSyslogSignalsTags] = useState([]);
  const [selTrapSignalsTags, setSelTrapSignalsTags] = useState([]);
  const [dropdowns, setDropdowns] = useState({
    trapEvents: { visible: false, position: { x: 0, y: 0 } },
    trapSignals: { visible: false, position: { x: 0, y: 0 } },
    syslogSignals: { visible: false, position: { x: 0, y: 0 } },
    syslogEvents: { visible: false, position: { x: 0, y: 0 } },
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

  useEffect(() => {
    console.log('Selected tags:', selectedTags);
  }, [selectedTags]);

  useEffect(() => {
    setDashboardTitle("Statistics Dashboard");
    return () => setDashboardTitle(''); // Clean up when navigating away
  }, [setDashboardTitle]);

  return (
    <div className="mainContainer">
      <div className="mainContainerHeader">
        <div className="headerTitles">
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
            onClick={(event) => handleButtonClick(event, 'signals')}
          >
            <PiAlignTopSimpleDuotone className="defaultIcon hasFilters" />
            <PiAlignTopSimpleFill className="hoverIcon" />
          </button>
          <button
            className="iconButton"
            onClick={(event) => handleButtonClick(event, 'events')}
          >
            <PiAlignBottomSimpleDuotone className="defaultIcon hasFilters" />
            <PiAlignBottomSimpleFill className="hoverIcon" />
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        {dataSource === 'syslogs' && <SyslogSignalsStatistics selSyslogSignalsTags={selSyslogSignalsTags} />}
        {dataSource === 'syslogs' && <SyslogEventsStatistics selSyslogEventsTags={selSyslogEventsTags} />}
        {dataSource === 'snmptraps' && <TrapSignalsStatistics selTrapSignalsTags={selTrapSignalsTags} />}
        {dataSource === 'snmptraps' && <TrapEventsStatistics selTrapEventsTags={selTrapEventsTags} />}
      </div>
      <div className="dropdownsContainer">
        {dataSource === 'syslogs' && (
          <div
            className={`dropdownMenu ${dropdowns.syslogEvents.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <SyslogEventsTags
              selSyslogEventsTags={selSyslogEventsTags}
              setSelSyslogEventsTags={setSelSyslogEventsTags}
            />
          </div>

        )}
        {dataSource === 'syslogs' && (
          <div
            className={`dropdownMenu ${dropdowns.syslogSignals.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <SyslogSignalsTags
              selSyslogSignalsTags={selSyslogSignalsTags}
              setSelSyslogSignalsTags={setSelSyslogSignalsTags}
            />
          </div>

        )}
        {dataSource === 'snmptraps' && (
          <div
            className={`dropdownMenu ${dropdowns.trapSignals.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <TrapSignalsTags
              selTrapSignalsTags={selTrapSignalsTags}
              setSelTrapSignalsTags={setSelTrapSignalsTags}
            />
          </div>

        )}
        {dataSource === 'snmptraps' && (
          <div
            className={`dropdownMenu ${dropdowns.trapEvents.visible ? 'dropdownVisible' : 'dropdownHidden'}`}
            style={{
              width: 'auto',
              maxHeight: '740px',
              overflow: 'hidden',
            }}
          >
            <TrapEventsTags
              selTrapEventsTags={selTrapEventsTags}
              setSelTrapEventsTags={setSelTrapEventsTags}
            />
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
          <SearchTime />
        </div>
      </div>
    </div>
  );
}

export default Statistics;
