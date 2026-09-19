import { useState, useEffect, useMemo, useRef } from "react";
import "../../css/SyslogDatabase.css";
import EventsTable from "../../components/misc/EventsTable.js";
import { useBgpLinkStateData } from "../../hooks/useBGPLSUpdates";

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

  /*
   * ---------------------------------------------------------
   * Stable filter representation
   * ---------------------------------------------------------
   *
   * Prevents the effect from firing just because the parent
   * creates a new selectedFilters object.
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
   *
   * These names now correspond directly to the normalized
   * OpenSearch document.
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
      label: "Protocol",
      value: "protocol",
    },
    {
      label: "Protocol Level",
      value: "protocol_level",
    },
    {
      label: "Source IP",
      value: "source_ip",
    },
    {
      label: "Neighbor IP",
      value: "neighbor_ip",
    },
    {
      label: "Source ASN",
      value: "source_asn",
    },
    {
      label: "Local Router ID",
      value: "local_router_id",
    },
    {
      label: "Local ASN",
      value: "local_asn",
    },
    {
      label: "Remote Router ID",
      value: "remote_router_id",
    },
    {
      label: "Remote ASN",
      value: "remote_asn",
    },
    {
      label: "Node Name",
      value: "node_name",
    },
    {
      label: "ISIS Area",
      value: "isis_area",
    },
    {
      label: "Link Metric",
      value: "link_metric",
    },
    {
      label: "Prefix",
      value: "prefix",
    },
    {
      label: "Next Hop",
      value: "next_hop",
    },
    {
      label: "Local Preference",
      value: "local_pref",
    },
  ];

  const activeTags =
    selectedTags?.length > 0
      ? selectedTags
      : defaultTags;

  /*
   * ---------------------------------------------------------
   * Row selection
   * ---------------------------------------------------------
   */

  const handleRowSelectChange = (newSelectedRows) => {
    setSelectedRows(newSelectedRows);
  };

  /*
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */

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