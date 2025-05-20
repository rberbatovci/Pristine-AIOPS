import React, { useState, useEffect, useRef } from 'react';
import { FaSortUp, FaSortDown, FaArrowsAltH, FaFilter } from 'react-icons/fa';
import { FormatDate } from './FormatDate';
import '../../css/EventsTable.css';

const EventsTable = ({ currentUser, data, columns, signalSource, onDownload, onRowSelectChange }) => {
  const [filterValues, setFilterValues] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [columnWidths, setColumnWidths] = useState({});
  const [isResizing, setIsResizing] = useState(false);
  const [resizeData, setResizeData] = useState({ column: '', startX: 0, startWidth: 0 });
  const [selectedRows, setSelectedRows] = useState([]);
  const [filterVisible, setFilterVisible] = useState({});

  const columnRefs = useRef({});

  useEffect(() => {
    const defaultWidths = {};
    columns.forEach((column) => {
      if (column === 'message' || column === 'content') {
        defaultWidths[column] = 1000;
      } else {
        defaultWidths[column] = 200;
      }
    });
    setColumnWidths(defaultWidths);
    const visibility = {};
    columns.forEach((column) => (visibility[column] = false));
    setFilterVisible(visibility);
  }, [columns]);

  const handleFilterChange = (column, value) => {
    setFilterValues({ ...filterValues, [column]: value });
  };

  const toggleFilterVisibility = (column) => {
    setFilterVisible((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const handleSort = (column) => {
    let direction = 'asc';
    if (sortConfig.key === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: column, direction });
  };

  // Start column resizing
  const startResize = (column, e) => {
    setIsResizing(true);
    setResizeData({
      column,
      startX: e.clientX,
      startWidth: columnRefs.current[column].offsetWidth,
    });
    document.body.style.userSelect = 'none'; // Prevent text selection
  };

  // Perform resizing based on mouse movement
  const handleMouseMove = (e) => {
    if (!isResizing) return;

    const { column, startX, startWidth } = resizeData;
    const newWidth = Math.max(startWidth + (e.clientX - startX), 50);

    setColumnWidths((prevWidths) => ({
      ...prevWidths,
      [column]: newWidth,
    }));
  };

  // Stop resizing when the mouse button is released
  const stopResize = () => {
    setIsResizing(false);
    document.body.style.userSelect = ''; // Re-enable text selection
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResize);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing]);

  const getValue = (row, columnName) => {
    if (columnName === 'timestamp') {
      return row['@timestamp'] || row['timestamp'] || '';
    } else if (columnName === 'SysUpTime') {
      return row['DISMAN-EXPRESSION-MIB::sysUpTimeInstance'] ?? '';
    } else if (columnName === 'SNMP Trap OID') {
      return row['SNMPv2-MIB::snmpTrapOID.0'] ?? '';
    }
    return row?.[columnName] ?? '';
  };

  // Handle row selection
  const handleRowSelect = (index) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = prevSelectedRows.includes(index)
        ? prevSelectedRows.filter((rowIndex) => rowIndex !== index)
        : [...prevSelectedRows, index];

      // Notify the parent component about the selected rows
      onRowSelectChange(newSelectedRows);
      return newSelectedRows;
    });
  };

  // Apply filtering and sorting to data
  let filteredData = data.filter((row) => {
    return columns.every((column) => {
      if (!filterValues[column]) return true;
      return row[column]?.toString().toLowerCase().includes(filterValues[column].toLowerCase());
    });
  });

  if (sortConfig.key) {
    filteredData = filteredData.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  // Function to convert selected rows to CSV format and trigger download
  const downloadSelectedRows = () => {
    const header = [...columns];
    const csvContent = [
      header.join(','), // Header row
      ...selectedRows.map((rowIndex) => {
        const row = data[rowIndex];
        return [
          ...columns.map((column) => {
            let value;
            if (column === 'timestamp') {
              value = FormatDate(row[column], currentUser.timezone); // Format timestamp
            } else if (column === 'content' && typeof row[column] === 'object') {
              // If the column is 'content' and contains a JSON object, stringify it
              value = JSON.stringify(row[column]).replace(/"/g, '""');
            } else {
              value = row[column] || '';
            }

            // Wrap the value in double quotes if it contains a comma or double quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              value = `"${value}"`;
            }

            return value;
          }),
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'selected_rows.csv');
    link.click();
  };

  onDownload(downloadSelectedRows);

  return (
    <div className="tableContainer">
      <table className="evenTable">
        <thead className="tableHeader3">
          <tr style={{ width: 'auto', minWidth: '100px', maxWidth: '140px' }}>
            <th className="selectHeader">Select</th>
            {columns.map((column) => (
              <th
                key={column}
                ref={(el) => (columnRefs.current[column] = el)}
                style={{
                  width: columnWidths[column] || 'auto',
                  whiteSpace: 'nowrap',
                  minWidth: columnWidths[column] || 'auto',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  height: '45px',
                  background: 'var(--tableDataHeaderBackground)',
                  borderRadius: '0',
                  justifyContent: 'flex-start',
                  borderRight: '1px solid var(--tableHeaderBorder)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {filterVisible[column] ? (
                    <input
                      type="text"
                      placeholder={`Filter ${column}`}
                      value={filterValues[column] || ''}
                      onChange={(e) => handleFilterChange(column, e.target.value)}
                      onBlur={() => toggleFilterVisibility(column)} // Hide input when it loses focus
                      style={{ width: 'calc(100% - 60px)', background: 'var(--contentBackground)', outline: 'none', border: 'none', padding: '6px 4px', borderRadius: '6px', paddingLeft: '12px', marginLeft: '10px' }}
                    />
                  ) : (
                    <span onClick={() => toggleFilterVisibility(column)} className="headerText">{column}</span>
                  )}
                  <div className="headerIcons">
                    <span onClick={() => handleSort(column)}>
                      {sortConfig.key === column && sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                    </span>
                    <span
                      className="resizeHandle"
                      style={{ marginRight: '10px' }}
                      onMouseDown={(e) => startResize(column, e)}
                    >
                      <FaArrowsAltH />
                    </span>
                  </div>
                </div>

              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tableBody">
          {filteredData.map((row, index) => (
            <tr
              key={index}
              onClick={() => handleRowSelect(index)}
              className={selectedRows.includes(index) ? 'selectedRow' : ''}
            >
              <td
                className="checkbox-column"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  height: '34px',
                  opacity: '.7',
                  color: 'blue',
                  borderRight: '1px solid var(--tableDataRowRightBorderColor)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  alignContent: 'center',
                  textAlign: 'center',
                  textSize: '12px',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedRows.includes(index)}
                  onChange={() => handleRowSelect(index)}
                />
              </td>
              {columns.map((column) => (
                <td
                  key={column}
                  style={{
                    width: columnWidths[column] || 'auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    height: '22px',
                    borderRight: '1px solid var(--tableDataRowRightBorderColor)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    alignContent: 'center',
                    textAlign: 'center',
                    minWidth: '150px',
                    maxWidth: '400px',
                    fontSize: '14px',
                  }}
                >
                  {column === 'content' && typeof getValue(row, column) === 'object'
                    ? JSON.stringify(getValue(row, column))
                    : getValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EventsTable;
