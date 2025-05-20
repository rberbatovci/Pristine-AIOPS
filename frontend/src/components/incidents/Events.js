import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { BsToggles } from 'react-icons/bs';
import EventsTable from '../misc/EventsTable.js';
import Select from 'react-select';
import '../../css/SignalEvents.css';
import TagColumns from '../syslogs/TagColumns.js';
import apiClient from '../misc/AxiosConfig.js';

function Events({ currentUser, syslogEvents, trapEvents, events, source, rule }) {
  const [signalEvents, setSignalEvents] = useState([]);
  const [showData, setShowData] = useState(true);
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedOids, setSelectedOids] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagsListPosition, setTagsListPosition] = useState({ top: 0, left: 0 });
  const [eventSource, setEventSource] = useState(source); // State to track the selected event source
  const buttonRef = useRef(null);

  const handleTagCheckboxChange = (tagValue) => {
    setSelectedTags((prevTags) => {
      const updatedTags = prevTags.includes(tagValue)
        ? prevTags.filter((tag) => tag !== tagValue)
        : [...prevTags, tagValue];

      setShowPanel(false);

      return updatedTags;
    });
  };

  const handleOidCheckboxChange = (oid) => {
    if (selectedOids.includes(oid)) {
      setSelectedOids(selectedOids.filter((selectedOid) => selectedOid !== oid));
    } else {
      setSelectedOids([...selectedOids, oid]);
    }
  };

  const toggleTagsList = (event) => {
    setShowPanel((prevShow) => !prevShow);
  };

  useEffect(() => {
    const handleMouseMove = (event) => {
      setTagsListPosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const getColumnsAndHeaders = () => {
    if (eventSource === 'syslog') {
      return {
        columns: ['timestamp', 'device', 'mnemonic', 'message', 'Severity'],
      };
    } else if (eventSource === 'snmptrap') {
      return {
        columns: ['timestamp', 'device', 'snmpTrapOid', 'content'],
      };
    }
    return {
      columns: [],
      columnHeaders: [],
    };
  };

  const handlePanelToggle = () => setShowPanel((prev) => !prev);

  const downloadRef = useRef(null);

  const handleDownloadClick = () => {
    if (downloadRef.current) {
      downloadRef.current();
    }
  };

  const { columns, columnHeaders } = getColumnsAndHeaders();

  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        setTagsListPosition({
          top: buttonRect.bottom + window.scrollY,
          left: buttonRect.left + window.scrollX,
        });
      }
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, []);

  const getSelectedColumns = () => {
    if (!rule) return columns;

    let { openSignalEvent, closeSignalEvent, affectedEntity } = rule;

    let signalEvents = [];
    if (openSignalEvent) signalEvents.push(openSignalEvent);
    if (closeSignalEvent && closeSignalEvent !== openSignalEvent) {
      signalEvents.push(closeSignalEvent);
    }

    let additionalColumns = [...new Set([...signalEvents, ...(Array.isArray(affectedEntity) ? affectedEntity : [])])];

    return [...new Set([...columns, ...additionalColumns])];
  };

  // Function to handle the switch between syslog and snmptrap events
  const handleSourceSwitch = () => {
    setEventSource((prevSource) => (prevSource === 'syslog' ? 'snmptrap' : 'syslog'));
  };

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Signal Events
        </h2>
        {showData && (
          <div className="headerButtons" style={{ background: 'none', marginRight: '10px' }}>
            {/* Switch Button */}
            <button
              className="headerButton"
              onClick={handleSourceSwitch}
              style={{ marginRight: '10px' }}
            >
              Switch to {eventSource === 'syslog' ? 'SNMP Traps' : 'Syslog'}
            </button>
            <button
              className="headerButton"
              onClick={toggleTagsList}
              onMouseEnter={() => setShowPanel(true)}
              onMouseLeave={() => setShowPanel(false)}
            >
              <BsToggles />
            </button>
          </div>
        )}
      </div>
      {showData && (
        <div className="signal-events-content" style={{ width: 'calc(100% - 15px)' }}>
          <EventsTable
            currentUser={currentUser}
            data={eventSource === 'syslog' ? syslogEvents : trapEvents} // Pass the correct events based on the selected source
            columns={getSelectedColumns()}
            signalSource={eventSource} // Pass the selected source to EventsTable
            onDownload={(downloadFn) => (downloadRef.current = downloadFn)}
          />
        </div>
      )}
      {showPanel && (
        <div
          className={`tagsPanel ${showPanel ? 'dropdownVisible' : 'dropdownHidden'}`}
          style={{
            position: 'absolute',
            top: `${tagsListPosition.top}px`,
            right: '10px',
            marginTop: '-140px',
          }}
          onMouseEnter={() => setShowPanel(true)}
          onMouseLeave={() => setShowPanel(false)}
        >
          <TagColumns
            tags={tags}
            selectedTags={selectedTags}
            handleTagCheckboxChange={handleTagCheckboxChange}
          />
        </div>
      )}
    </div>
  );
}

export default Events;