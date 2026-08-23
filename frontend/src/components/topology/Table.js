import { useState, useEffect, useMemo, useRef } from "react";
import "../../css/SyslogDatabase.css";
import EventsTable from "../../components/misc/EventsTable.js";
import { useBgpLinkStateData } from "../../hooks/useBGPLSUpdates";
import { useLocation } from "react-router-dom";

function BgpLinkStateEventTable({
  setDashboardTitle,
  keycloak,
  startTime,
  endTime,
  selectedFilters = {},
  selectedTags = [],
}) {
  const {
    eventsData,
    totalEvents,
    totalPages,
    loading,
    error,
    loadData,
  } = useBgpLinkStateData();

  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState([]);

  const dropdownWrapperRef = useRef(null);
  const location = useLocation();

  /*
   * ---------------------------------------------------------
   * Stable filter representation
   * ---------------------------------------------------------
   *
   * Prevents the effect from firing just because the parent
   * created a new selectedFilters object.
   */
  const filtersKey = useMemo(() => {
    return JSON.stringify(selectedFilters || {});
  }, [selectedFilters]);

  /*
   * ---------------------------------------------------------
   * Stable time values
   * ---------------------------------------------------------
   */
  const startTimeValue = useMemo(() => {
    if (!startTime) return null;

    return startTime instanceof Date
      ? startTime.toISOString()
      : new Date(startTime).toISOString();
  }, [startTime]);

  const endTimeValue = useMemo(() => {
    if (!endTime) return null;

    return endTime instanceof Date
      ? endTime.toISOString()
      : new Date(endTime).toISOString();
  }, [endTime]);

  /*
   * ---------------------------------------------------------
   * Parse filters only when filtersKey changes
   * ---------------------------------------------------------
   */
  const stableFilters = useMemo(() => {
    try {
      return JSON.parse(filtersKey);
    } catch {
      return {};
    }
  }, [filtersKey]);

  /*
   * ---------------------------------------------------------
   * Reset page when query parameters change
   * ---------------------------------------------------------
   */
  useEffect(() => {
    setPage(1);
  }, [
    startTimeValue,
    endTimeValue,
    filtersKey,
  ]);

  /*
   * ---------------------------------------------------------
   * Load data
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (!keycloak?.authenticated) {
      return;
    }

    loadData(
      keycloak,
      page,
      startTimeValue,
      endTimeValue,
      stableFilters
    );
  }, [
    keycloak?.authenticated,
    page,
    startTimeValue,
    endTimeValue,
    filtersKey,
    loadData,
  ]);

  /*
   * ---------------------------------------------------------
   * Dashboard title
   * ---------------------------------------------------------
   */
  useEffect(() => {
    setDashboardTitle("Topology Dashboard");

    return () => {
      setDashboardTitle("");
    };
  }, [setDashboardTitle]);

  /*
   * ---------------------------------------------------------
   * Default BGP-LS columns
   * ---------------------------------------------------------
   */
  const defaultTags = [
    {
      label: "Timestamp",
      value: "timestamp",
    },
    {
      label: "Event Type",
      value: "event_type",
    },
    {
      label: "Withdraw",
      value: "is_withdraw",
    },
    {
      label: "NLRI Type",
      value: "nlri_type",
    },
    {
      label: "Source ID",
      value: "sourceId",
    },
    {
      label: "Neighbor IP",
      value: "neighborIp",
    },
    {
      label: "Source ASN",
      value: "sourceAsn",
    },
    {
      label: "IGP Router ID",
      value: "localNode.igpRouterId",
    },
    {
      label: "Remote Router ID",
      value: "remoteNode.igpRouterId",
    },
    {
      label: "Prefix",
      value: "prefix",
    },
    {
      label: "IGP Metric",
      value: "igpMetric",
    },
  ];

  const activeTags =
    selectedTags?.length > 0
      ? selectedTags
      : defaultTags;

  const handleRowSelectChange = (newSelectedRows) => {
    setSelectedRows(newSelectedRows);
  };

  return (
    <div
      className="mainContainer"
      ref={dropdownWrapperRef}
      style={{
        marginTop: "10px",
        maxWidth: "85%",
        paddingTop: "5px",
      }}
    >
      <div className="mainContainerContent">

        {loading && (
          <div className="loadingMessage">
            Loading BGP Link State updates...
          </div>
        )}

        {error && (
          <div className="errorMessage">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="syslogsTableContainer">
            <EventsTable
              source="bgp-link-state"
              type="events"
              data={eventsData}
              totalPages={totalPages}
              tags={activeTags}
              onRowSelectChange={handleRowSelectChange}
              page={page}
              onPageChange={setPage}
              keycloak={keycloak}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default BgpLinkStateEventTable;