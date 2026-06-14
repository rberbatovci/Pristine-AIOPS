import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import '../../css/Header.css';

import { FaRegUserCircle, FaUserCircle, FaClock, FaRegClock } from "react-icons/fa";
import { IoSettingsOutline, IoSettings } from "react-icons/io5";
import {
  RiAddCircleLine, RiAddCircleFill, RiSearchEyeLine, RiSearchEyeFill, RiDownloadCloudLine,
  RiDownloadCloudFill, RiFilterLine, RiFilterFill, RiInfoCardLine, RiInfoCardFill
} from "react-icons/ri";
import { TfiLayoutListThumb, TfiLayoutListThumbAlt } from "react-icons/tfi";
import { HiOutlineViewColumns, HiViewColumns } from "react-icons/hi2";
import { IoPieChartSharp, IoPieChartOutline } from "react-icons/io5";
import {
  PiArticleMediumLight, PiArticleMediumFill, PiUploadBold, PiUploadFill,
  PiBatteryWarningVerticalBold, PiBatteryWarningVerticalFill
} from "react-icons/pi";
import { MdBookmarkBorder, MdBookmark, MdOutlineRuleFolder, MdRuleFolder } from "react-icons/md";

const Header = ({ currentUser, dashboardTitle, onTogglePopup, selectedDevice }) => {

  const location = useLocation();
  const navigate = useNavigate();

  /* =========================================================
   * VIEW DETECTION
   * ========================================================= */
  const currentView =
    location.pathname.split('/').pop() === 'statistics'
      ? 'statistics'
      : 'table';

  const isStatisticsView = currentView === 'statistics';
  const isSyslogEvents = location.pathname.includes('/events/syslogs');
  const isSnmpTrapEvents = location.pathname.includes('/events/snmp-traps');
  const isSyslogSignals = location.pathname.includes('/signals/syslogs');
  const isSnmpTrapSignals = location.pathname.includes('/signals/snmp-traps');
  const isTelemetrySignals = location.pathname.includes('/signals/telemetry');

  const toggleView = () => {
    const path = location.pathname;

    const newPath = path.replace(
      /(table|statistics)$/,
      currentView === 'table'
        ? 'statistics'
        : 'table'
    );

    navigate(newPath);
  };

  const buildRoute = (basePath) => {
    return `${basePath}/${currentView}`;
  };

  /* =========================================================
   * FILTER LOGIC
   * ========================================================= */
  const getFilterPopupId = (dashboard) => {
    const path = location.pathname;

    if (dashboard === 'signals') {
      if (path.includes('/syslogs')) return 'filter-syslog-signals';
      if (path.includes('/snmp-traps')) return 'filter-snmptrap-signals';
      if (path.includes('/telemetry')) return 'filter-telemetry-signals';
      return 'filter-signals';
    }

    if (dashboard === 'events') {
      if (path.includes('/syslogs')) return 'filter-syslog-events';
      if (path.includes('/snmp-traps')) return 'filter-snmptrap-events';
      return 'filter-events';
    }

    return 'filters';
  };

  /* =========================================================
   * NAV LINKS
   * ========================================================= */
  const renderNavigationOptions = () => {
    switch (dashboardTitle) {

      case 'Signals Dashboard':
        return (
          <>
            <NavLink
              to="/signals/syslogs/table"
              style={linkStyle}
            >
              Syslogs
            </NavLink>

            <NavLink
              to="/signals/snmp-traps/table"
              style={linkStyle}
            >
              SNMP Traps
            </NavLink>

            <NavLink
              to="/signals/telemetry/table"
              style={linkStyle}
            >
              Telemetry
            </NavLink>
          </>
        );

      case 'Events Dashboard':
        return (
          <>
            <NavLink
              to="/events/syslogs/table"
              style={linkStyle}
            >
              Syslogs
            </NavLink>

            <NavLink
              to="/events/snmp-traps/table"
              style={linkStyle}
            >
              SNMP Traps
            </NavLink>
          </>
        );

      default:
        return null;
    }
  };

  /* =========================================================
   * ACTION BUTTONS
   * ========================================================= */
  const renderActionButtons = () => {

    switch (dashboardTitle) {

      case 'Signals Dashboard':
        return (
          <>
            {isSyslogSignals && (
              <>
                {!isStatisticsView ? (
                  <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => navigate('/signals/syslogs/statistics')} title="View Statistics" >
                    <TfiLayoutListThumb className="defaultIcon" />
                    <IoPieChartSharp className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => navigate('/signals/syslogs/table')} title="View Table" >
                    <IoPieChartOutline className="defaultIcon" />
                    <TfiLayoutListThumbAlt className="hoverIcon" />
                  </button>
                )}
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("syslog-signals-severity")}
                  title="Syslog Signals Severity"
                >
                  <PiBatteryWarningVerticalBold className="defaultIcon" />
                  <PiBatteryWarningVerticalFill className="hoverIcon" />
                </button>
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("stateful-syslog-rules")}
                  title="Stateful Syslog Rules"
                  style={{ marginRight: '10px' }}
                >
                  <MdOutlineRuleFolder className="defaultIcon" />
                  <MdRuleFolder className="hoverIcon" />
                </button>
                {!isStatisticsView ? (
                  <button className="iconButton" onClick={() => onTogglePopup("syslog-signal-table-tags")} title="Toggle Syslog Signal Table Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" onClick={() => onTogglePopup("syslog-signal-statistics-tags")} title="Toggle Syslog Signal Statistics Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                )}
              </>
            )}
            {isSnmpTrapSignals && (
              <>
                {!isStatisticsView ? (
                  <button className="iconButton" onClick={() => navigate('/signals/snmp-traps/statistics')} title="View Statistics" >
                    <TfiLayoutListThumb className="defaultIcon" />
                    <IoPieChartSharp className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" onClick={() => navigate('/signals/snmp-traps/table')} title="View Table" >
                    <IoPieChartOutline className="defaultIcon" />
                    <TfiLayoutListThumbAlt className="hoverIcon" />
                  </button>
                )}
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("stateful-snmptrap-rules")}
                  title="Stateful SNMP Trap Rules"
                  style={{ marginRight: '10px' }}
                >
                  <MdOutlineRuleFolder className="defaultIcon" />
                  <MdRuleFolder className="hoverIcon" />
                </button>
                {!isStatisticsView ? (
                  <button className="iconButton" onClick={() => onTogglePopup("snmptrap-signal-table-tags")} title="Toggle SNMP Trap Signal Table Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" onClick={() => onTogglePopup("snmptrap-signal-statistics-tags")} title="Toggle SNMP Trap Signal Statistics Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                )}
              </>
            )}
            <button
              className="iconButton"
              onClick={() => onTogglePopup(getFilterPopupId('signals'))}
              title="Filters"
            >
              <RiFilterLine className="defaultIcon" />
              <RiFilterFill className="hoverIcon" />
            </button>
            <button
              className="iconButton"
              onClick={() => onTogglePopup("timerange")}
              title="Time Range"
            >
              <FaRegClock className="defaultIcon" />
              <FaClock className="hoverIcon" />
            </button>
            <button
              className="iconButton"
              onClick={() => onTogglePopup("export")}
              title="Export"
            >
              <RiDownloadCloudLine className="defaultIcon" />
              <RiDownloadCloudFill className="hoverIcon" />
            </button>

            {/* USER */}
            <button
              className="iconButton"
              onClick={() => onTogglePopup("user-profile")}
              title="User"
            >
              <FaRegUserCircle className="defaultIcon" />
              <FaUserCircle className="hoverIcon" />
            </button>
          </>
        );
      case 'Events Dashboard':
        return (
          <>
            {isSyslogEvents && (
              <>
                {!isStatisticsView ? (
                  <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => navigate('/events/syslogs/statistics')} title="View Syslog Event Statistics" >
                    <TfiLayoutListThumb className="defaultIcon" />
                    <IoPieChartSharp className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => navigate('/events/syslogs/table')} title="View Syslog Event Table" >
                    <IoPieChartOutline className="defaultIcon" />
                    <TfiLayoutListThumbAlt className="hoverIcon" />
                  </button>
                )}
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("syslog-mnemonics")}
                  title="Mnemonics"
                >
                  <PiArticleMediumLight className="defaultIcon" />
                  <PiArticleMediumFill className="hoverIcon" />
                </button>
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("syslog-regexes")}
                  title="Regular Expressions"
                >
                  <MdBookmarkBorder className="defaultIcon" />
                  <MdBookmark className="hoverIcon" />
                </button>
                {!isStatisticsView ? (
                  <button className="iconButton" onClick={() => onTogglePopup("syslog-event-table-tags")} title="Toggle Syslog Events Table Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" onClick={() => onTogglePopup("syslog-event-statistics-tags")} title="Toggle Syslog Events Statistics Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                )}
              </>
            )}
            {isSnmpTrapEvents && (
              <>
                {!isStatisticsView ? (
                  <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => navigate('/events/snmp-traps/statistics')} title="View SNMP Trap Event Statistics" >
                    <TfiLayoutListThumb className="defaultIcon" />
                    <IoPieChartSharp className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" style={{ marginRight: '20px' }} onClick={() => navigate('/events/snmp-traps/table')} title="View SNMP Trap Event Table" >
                    <IoPieChartOutline className="defaultIcon" />
                    <TfiLayoutListThumbAlt className="hoverIcon" />
                  </button>
                )}
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("snmptrap-mibs")}
                  title="SNMP Trap MIB files"
                >
                  <PiUploadBold className="defaultIcon" />
                  <PiUploadFill className="hoverIcon" />
                </button>
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("snmptrap-oids")}
                  title="SNMP Trap OID Configurations"
                >
                  <RiInfoCardLine className="defaultIcon" />
                  <RiInfoCardFill className="hoverIcon" />
                </button>
                <button
                  className="iconButton"
                  onClick={() => onTogglePopup("snmptrap-tag-config")}
                  title="SNMP Trap Tags Configuration"
                >
                  <MdBookmarkBorder className="defaultIcon" />
                  <MdBookmark className="hoverIcon" />
                </button>
                {!isStatisticsView ? (
                  <button className="iconButton" onClick={() => onTogglePopup("snmptrap-event-table-tags")} title="Toggle SNMP Trap Events Table Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                ) : (
                  <button className="iconButton" onClick={() => onTogglePopup("snmptrap-event-statistics-tags")} title="Toggle SNMP Trap Events Statistics Tags" >
                    <HiOutlineViewColumns className="defaultIcon" />
                    <HiViewColumns className="hoverIcon" />
                  </button>
                )}
              </>
            )}

            <button
              className="iconButton"
              onClick={() => onTogglePopup(getFilterPopupId('events'))}
              title="Event Filters"
            >
              <RiFilterLine className="defaultIcon" />
              <RiFilterFill className="hoverIcon" />
            </button>
            <button
              className="iconButton"
              onClick={() => onTogglePopup("timerange")}
              title="Time Range"
            >
              <FaRegClock className="defaultIcon" />
              <FaClock className="hoverIcon" />
            </button>
            <button
              className="iconButton"
              onClick={() => onTogglePopup("export")}
              title="Export"
            >
              <RiDownloadCloudLine className="defaultIcon" />
              <RiDownloadCloudFill className="hoverIcon" />
            </button>

            {/* USER */}
            <button
              className="iconButton"
              onClick={() => onTogglePopup("user-profile")}
              title="User"
            >
              <FaRegUserCircle className="defaultIcon" />
              <FaUserCircle className="hoverIcon" />
            </button>
          </>
        );
      case 'Devices Dashboard':
        return (
          <>
            {!selectedDevice ? (
              <>
                <button className="iconButton" onClick={() => onTogglePopup("scan-network")} title="Scan Network">
                  <RiSearchEyeLine className="defaultIcon" />
                  <RiSearchEyeFill className="hoverIcon" />
                </button>
                <button className="iconButton" onClick={() => onTogglePopup("add-device")} title="Add Device">
                  <RiAddCircleLine className="defaultIcon" />
                  <RiAddCircleFill className="hoverIcon" />
                </button>
                <button className="iconButton" onClick={() => onTogglePopup("user-profile")} title="User">
                  <FaRegUserCircle className="defaultIcon" />
                  <FaUserCircle className="hoverIcon" />
                </button></>
            ) : (
              <>
                <button className="iconButton" onClick={() => onTogglePopup("device-settings")} title="Device Settings">
                  <IoSettingsOutline className="defaultIcon" />
                  <IoSettings className="hoverIcon" />
                </button>
                <button className="iconButton" onClick={() => onTogglePopup("user-profile")} title="User">
                  <FaRegUserCircle className="defaultIcon" />
                  <FaUserCircle className="hoverIcon" />
                </button>
              </>
            )}
          </>
        );
      case 'Traffic Dashboard':
        return (
          <>
            {!isStatisticsView ? (
              <button className="iconButton" style={{ marginRight: '20px' }} onClick={toggleView} title="Switch View">
                <TfiLayoutListThumb className="defaultIcon" />
                <IoPieChartSharp className="hoverIcon" />
              </button>
            ) : (
              <button className="iconButton" style={{ marginRight: '20px' }} onClick={toggleView} >
                <IoPieChartOutline className="defaultIcon" />
                <TfiLayoutListThumbAlt className="hoverIcon" />
              </button>
            )}
            {!isStatisticsView ? (
              <button className="iconButton" onClick={() => onTogglePopup("traffic-table-tags")} title="Toggle Traffic Table Tags" >
                <HiOutlineViewColumns className="defaultIcon" />
                <HiViewColumns className="hoverIcon" />
              </button>
            ) : (
              <button className="iconButton" onClick={() => onTogglePopup("traffic-statistics-tags")} title="Toggle Traffic Statistics Tags" >
                <HiOutlineViewColumns className="defaultIcon" />
                <HiViewColumns className="hoverIcon" />
              </button>
            )}
            <button className="iconButton" onClick={() => onTogglePopup("filter-traffic")} title="Filter Traffic">
              <RiFilterLine className="defaultIcon" />
              <RiFilterFill className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={() => onTogglePopup("timerange")} title="Time Range">
              <FaRegClock className="defaultIcon" />
              <FaClock className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={() => onTogglePopup("user-profile")} title="User">
              <FaRegUserCircle className="defaultIcon" />
              <FaUserCircle className="hoverIcon" />
            </button>
            
          </>
        );
      case 'Performance Dashboard':
        return (
          <>
            <button className="iconButton" onClick={() => onTogglePopup("filter-device")} title="Filter Device">
              <RiFilterLine className="defaultIcon" />
              <RiFilterFill className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={() => onTogglePopup("timerange")} title="Time Range">
              <FaRegClock className="defaultIcon" />
              <FaClock className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={() => onTogglePopup("user-profile")} title="User">
              <FaRegUserCircle className="defaultIcon" />
              <FaUserCircle className="hoverIcon" />
            </button>
          </>
        );
      case 'Topology Dashboard':
        return (
          <>
            <button className="iconButton" onClick={() => onTogglePopup("filter-device")} title="Filter Device">
              <RiFilterLine className="defaultIcon" />
              <RiFilterFill className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={() => onTogglePopup("timerange")} title="Time Range">
              <FaRegClock className="defaultIcon" />
              <FaClock className="hoverIcon" />
            </button>
            <button className="iconButton" onClick={() => onTogglePopup("user-profile")} title="User">
              <FaRegUserCircle className="defaultIcon" />
              <FaUserCircle className="hoverIcon" />
            </button>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="header-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: '20px' }}>
        {dashboardTitle && (
          <span style={{ fontSize: '20px', fontFamily: "'Russo One', sans-serif" }}>
            {dashboardTitle}
          </span>
        )}
        <nav style={{ display: 'flex', gap: '10px' }}>
          {renderNavigationOptions()}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '20px', color: 'inherit' }}>
        {renderActionButtons()}
      </div>
    </div>
  );
};

const linkStyle = {
  fontWeight: 'lighter',
  marginLeft: '10px',
  fontSize: '15px',
  opacity: '.8',
  textDecoration: 'none',
  color: 'inherit'
};

export default Header;