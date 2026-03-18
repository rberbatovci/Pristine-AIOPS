import React, { useState, useEffect, useRef } from "react";
import { FaSortUp, FaSortDown, FaArrowsAltH } from "react-icons/fa";
import Pagination from "@mui/material/Pagination";
import { FormatDate } from "./FormatDate";
import "../../css/EventsTable.css";

const DEFAULT_WIDTH = 220;
const LARGE_WIDTH = 700;
const MIN_WIDTH = 80;
const rowsPerPage = 21;

const EventsTable = ({
  data,
  totalPages,
  columns,
  signalSource,
  onRowSelectChange,
  page,
  onPageChange
}) => {
  const columnRefs = useRef({});
  const [filterValues, setFilterValues] = useState({});
  const [filterVisible, setFilterVisible] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = JSON.parse(localStorage.getItem("eventsTableWidths") || "{}");
    return saved;
  });
  const [resizeState, setResizeState] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);

  const COLUMN_DEFAULT_WIDTHS = {
    timestamp: 180,
    host: 200,
    severity: 120,
    facility: 140,
    message: 700,
    content: 700
  };

  /* ---------------- DEFAULT COLUMN WIDTHS ---------------- */
  useEffect(() => {
    setColumnWidths((prev) => {
      const updated = { ...prev };

      columns.forEach(({ value }) => {
        if (!updated[value]) {
          updated[value] =
            COLUMN_DEFAULT_WIDTHS[value] ?? DEFAULT_WIDTH;
        }
      });

      return updated;
    });

    // initialize filter visibility
    setFilterVisible((prev) => {
      const updated = { ...prev };

      columns.forEach(({ value }) => {
        if (!(value in updated)) {
          updated[value] = false;
        }
      });

      return updated;
    });

  }, [columns]);


  useEffect(() => {
    localStorage.setItem("eventsTableWidths", JSON.stringify(columnWidths));
  }, [columnWidths]);

  /* ---------------- FILTER ---------------- */
  const handleFilterChange = (column, value) => {
    setFilterValues((prev) => ({ ...prev, [column]: value }));
  };

  const toggleFilter = (column) => {
    setFilterVisible((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  /* ---------------- SORT ---------------- */
  const handleSort = (column) => {
    let direction = "asc";

    if (sortConfig.key === column && sortConfig.direction === "asc") {
      direction = "desc";
    }

    setSortConfig({ key: column, direction });
  };

  /* ---------------- RESIZE ---------------- */
  const startResize = (column, e) => {
    e.preventDefault();

    setResizeState({
      column,
      startX: e.clientX,
      startWidth: columnRefs.current[column].offsetWidth,
    });

    document.body.style.userSelect = "none";
  };

  const handleMouseMove = (e) => {
    if (!resizeState) return;

    const { column, startX, startWidth } = resizeState;

    const newWidth = Math.max(
      startWidth + (e.clientX - startX),
      MIN_WIDTH
    );

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

  /* ---------------- VALUE RESOLVER ---------------- */
  const getValue = (row, column) => {
    if (column === "timestamp") {
      return row["@timestamp"] || row["timestamp"] || "";
    }

    if (signalSource === "syslogs" && row.tags && column in row.tags) {
      return row.tags[column];
    }

    if (signalSource === "snmptraps" && row.content && column in row.content) {
      return row.content[column];
    }

    return row?.[column] ?? "";
  };

  /* ---------------- ROW SELECT ---------------- */
  const handleRowSelect = (index) => {
    setSelectedRows((prev) => {
      const updated = prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index];

      onRowSelectChange(updated);
      return updated;
    });
  };

  /* ---------------- FILTER + SORT ---------------- */
  let filteredData = (data || []).filter((row) =>
    columns.every(({ value }) => {
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

  /* ---------------- RENDER ---------------- */
  return (
    <div className="eventsTableWrapper">
      <div className="tableContainer">
        <table className="eventsTable">
          <thead>
            <tr>
              <th className="selectHeader">Select</th>
              {columns.map(({ label, value }) => (
                <th key={value} ref={(el) => (columnRefs.current[value] = el)} style={{ width: columnWidths[value] || 'auto' }} >
                  <div className="headerCell">
                    {filterVisible[value] ? (
                      <input type="text" placeholder={`Filter ${label}`} value={filterValues[value] || ""} onChange={(e) => handleFilterChange(value, e.target.value)} onBlur={() => toggleFilter(value)} className="filterInput" />
                    ) : (
                      <span className="headerText" onClick={() => toggleFilter(value)} > {label} </span>
                    )}
                    <div className="headerIcons">
                      <span onClick={() => handleSort(value)}>
                        {sortConfig.key === value && sortConfig.direction === "asc" ? (<FaSortUp />) : (<FaSortDown />)}
                      </span>
                      <span className="resizeHandle" onMouseDown={(e) => startResize(value, e)} >
                        <FaArrowsAltH />
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => {
              return (
                <tr key={index} className={selectedRows.includes(index) ? "selectedRow" : ""} onClick={() => handleRowSelect(index)} >
                  <td className="checkboxColumn">
                    <input type="checkbox" checked={selectedRows.includes(index)} onChange={() => handleRowSelect(index)} />
                  </td>
                  {columns.map(({ value }) => {
                    const val = getValue(row, value);
                    return (
                      <td
                        key={value}
                        style={{
                          width: columnWidths[value],
                          maxWidth: columnWidths[value],
                        }}
                      >
                        <span className="cellContent">
                          {value === "content" && typeof val === "object"
                            ? JSON.stringify(val)
                            : val}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="paginationContainer">
        <Pagination count={totalPages} page={page} onChange={(e, value) => onPageChange(value)} shape="rounded" color="primary" sx={{ "& .MuiPaginationItem-root": { color: "var(--textColor)" } }} />
      </div>
    </div>
  );
};

export default EventsTable;