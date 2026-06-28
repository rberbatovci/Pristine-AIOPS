import React, { useState, useEffect, useRef } from "react";
import { FaSortUp, FaSortDown, FaArrowsAltH } from "react-icons/fa";
import Pagination from "@mui/material/Pagination";
import { FormatDate } from "./FormatDate";
import "../../css/EventsTable.css";
import { useUserPreferences } from "../../hooks/useUserPreferences";

const DEFAULT_WIDTH = 220;
const MIN_WIDTH = 80;

const COLUMN_DEFAULT_WIDTHS = {
  timestamp: 180,
  "@timestamp": 180,
  host: 200,
  severity: 120,
  facility: 140,
  message: 700,
  content: 700
};

const EventsTable = ({
  keycloak,
  timezone, // fallback prop
  data = [],
  totalPages = 1,
  tags = [],
  signalSource,
  onRowSelectChange,
  page,
  onPageChange
}) => {
  const columnRefs = useRef({});
  const [filterValues, setFilterValues] = useState({});
  const [filterVisible, setFilterVisible] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [selectedRows, setSelectedRows] = useState([]);

  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem("eventsTableWidths");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const { preferences, loading: preferencesLoading, reload: reloadPreferences } = useUserPreferences(keycloak);

  // Resolve active timezone safely
  const activeTimezone = preferences?.timezone || timezone || "UTC";

  console.log("Active Timezone being used:", activeTimezone);

  const [resizeState, setResizeState] = useState(null);

  /* ---------------- TRACK LAYOUT & TAG SYNC ---------------- */
  useEffect(() => {
    if (!Array.isArray(tags)) return;

    setColumnWidths((prev) => {
      const updated = { ...prev };
      tags.forEach(({ value }) => {
        if (!updated[value]) {
          updated[value] = COLUMN_DEFAULT_WIDTHS[value] ?? DEFAULT_WIDTH;
        }
      });
      return updated;
    });

    setFilterVisible((prev) => {
      const updated = { ...prev };
      tags.forEach(({ value }) => {
        if (!(value in updated)) {
          updated[value] = false;
        }
      });
      return updated;
    });
  }, [tags]);

  useEffect(() => {
    localStorage.setItem("eventsTableWidths", JSON.stringify(columnWidths));
  }, [columnWidths]);

  /* ---------------- VALUE RESOLVER ---------------- */
  const getValue = (row, column) => {
    if (!row) return "";

    const source = row._source || row;

    // 1. If the column is 'timestamp' or '@timestamp', check both variants in the source
    if (column === "timestamp" || column === "@timestamp") {
      const timeVal = source.timestamp ?? source["@timestamp"];
      if (timeVal !== undefined && timeVal !== null) return timeVal;
    }

    if (source[column] !== undefined && source[column] !== null) {
      return source[column];
    }

    if (signalSource === "syslogs" && source.tags && column in source.tags) {
      return source.tags[column];
    }

    if (signalSource === "snmptraps" && source.content && column in source.content) {
      return source.content[column];
    }

    return "";
  };

  /* ---------------- FILTERING & ACTIONS ---------------- */
  const handleFilterChange = (column, value) => {
    setFilterValues((prev) => ({ ...prev, [column]: value }));
  };

  const toggleFilter = (column) => {
    setFilterVisible((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const handleSort = (column) => {
    let direction = "asc";
    if (sortConfig.key === column && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: column, direction });
  };

  const handleRowSelect = (index) => {
    setSelectedRows((prev) => {
      const updated = prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index];

      if (onRowSelectChange) onRowSelectChange(updated);
      return updated;
    });
  };

  /* ---------------- COLUMN RESIZING ---------------- */
  const startResize = (column, e) => {
    e.preventDefault();
    setResizeState({
      column,
      startX: e.clientX,
      startWidth: columnRefs.current[column]?.offsetWidth || DEFAULT_WIDTH,
    });
    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e) => {
    if (!resizeState) return;
    const { column, startX, startWidth } = resizeState;
    const newWidth = Math.max(startWidth + (e.clientX - startX), MIN_WIDTH);

    setColumnWidths((prev) => ({
      ...prev,
      [column]: newWidth,
    }));
  };

  const stopResize = () => {
    setResizeState(null);
    document.body.style.userSelect = "";
  };

  useEffect(() => {
    if (!resizeState) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [resizeState]);

  /* ---------------- RUN DATA CONSTRAINTS ---------------- */
  const validTags = Array.isArray(tags) ? tags : [];

  let filteredData = (data || []).filter((row) =>
    validTags.every(({ value }) => {
      if (!filterValues[value]) return true;
      const val = getValue(row, value);
      return val
        ?.toString()
        .toLowerCase()
        .includes(filterValues[value].toLowerCase());
    })
  );

  if (sortConfig.key) {
    filteredData = [...filteredData].sort((a, b) => {
      const valA = getValue(a, sortConfig.key);
      const valB = getValue(b, sortConfig.key);
      if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  } 

  return (
    <div className="eventsTableWrapper">
      <div className="tableContainer">
        <table className="eventsTable">
          <thead>
            <tr>
              <th className="selectHeader">Select</th>
              {validTags.map(({ label, value }) => (
                <th
                  key={value}
                  ref={(el) => (columnRefs.current[value] = el)}
                  style={{ width: columnWidths[value] || "auto" }}
                >
                  <div className="headerCell">
                    {filterVisible[value] ? (
                      <input
                        type="text"
                        placeholder={`Filter ${label}`}
                        value={filterValues[value] || ""}
                        onChange={(e) => handleFilterChange(value, e.target.value)}
                        onBlur={() => toggleFilter(value)}
                        className="filterInput"
                        autoFocus
                      />
                    ) : (
                      <span className="headerText" onClick={() => toggleFilter(value)}>
                        {label}
                      </span>
                    )}
                    <div className="headerIcons">
                      <span onClick={() => handleSort(value)} style={{ cursor: "pointer" }}>
                        {sortConfig.key === value && sortConfig.direction === "asc" ? (
                          <FaSortUp />
                        ) : (
                          <FaSortDown />
                        )}
                      </span>
                      <span className="resizeHandle" onMouseDown={(e) => startResize(value, e)}>
                        <FaArrowsAltH />
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr
                key={index}
                className={selectedRows.includes(index) ? "selectedRow" : ""}
                onClick={() => handleRowSelect(index)}
              >
                <td className="checkboxColumn" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(index)}
                    onChange={() => handleRowSelect(index)}
                  />
                </td>
                {validTags.map(({ value }) => {
                  const val = getValue(row, value);
                  const cellWidth = columnWidths[value] || DEFAULT_WIDTH;
                  const isTimestampColumn = value === "timestamp" || value === "@timestamp";
                  return (
                    <td
                      key={value}
                      style={{
                        width: cellWidth,
                        maxWidth: cellWidth,
                      }}
                    >
                      <span className="cellContent">
                        {isTimestampColumn && val ? (
                          /* Safely passes the backend string and user timezone preferences */
                          <FormatDate dateStr={val} timezone={activeTimezone} />
                        ) : typeof val === "object" ? (
                          JSON.stringify(val)
                        ) : (
                          val?.toString()
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="paginationContainer">
        <Pagination
          count={totalPages}
          page={page}
          onChange={(e, value) => onPageChange(value)}
          shape="rounded"
          color="primary"
          sx={{ "& .MuiPaginationItem-root": { color: "var(--textColor)" } }}
        />
      </div>
    </div>
  );
};

export default EventsTable;