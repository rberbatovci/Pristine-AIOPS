import React, { useState, useEffect, useRef } from 'react';
import { FaSortUp, FaSortDown, FaArrowsAltH } from 'react-icons/fa';
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
    columns.forEach(({ value }) => {
      defaultWidths[value] = (value === 'message' || value === 'content') ? 1000 : 200;
    });
    setColumnWidths(defaultWidths);

    const visibility = {};
    columns.forEach(({ value }) => (visibility[value] = false));
    setFilterVisible(visibility);
    console.log("Received columns:", columns);
  }, [columns]);

  const handleFilterChange = (columnValue, value) => {
    setFilterValues({ ...filterValues, [columnValue]: value });
  };

  const toggleFilterVisibility = (columnValue) => {
    setFilterVisible((prev) => ({
      ...prev,
      [columnValue]: !prev[columnValue],
    }));
  };

  const handleSort = (columnValue) => {
    let direction = 'asc';
    if (sortConfig.key === columnValue && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: columnValue, direction });
  };

  // Start column resizing
  const startResize = (columnValue, e) => {
    setIsResizing(true);
    setResizeData({
      column: columnValue,
      startX: e.clientX,
      startWidth: columnRefs.current[columnValue].offsetWidth,
    });
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isResizing) return;

    const { column, startX, startWidth } = resizeData;
    const newWidth = Math.max(startWidth + (e.clientX - startX), 50);

    setColumnWidths((prevWidths) => ({
      ...prevWidths,
      [column]: newWidth,
    }));
  };

  const stopResize = () => {
    setIsResizing(false);
    document.body.style.userSelect = '';
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

  const getValue = (row, columnValue, signalSource) => {
    if (columnValue === 'timestamp') {
      return row['@timestamp'] || row['timestamp'] || '';
    }

    if (signalSource === 'syslogs' && row.tags && columnValue in row.tags) {
      return row.tags[columnValue];
    }

    if (signalSource === 'snmptraps' && row.content && columnValue in row.content) {
      return row.content[columnValue];
    }

    return row?.[columnValue] ?? '';
  };

  // Handle row selection
  const handleRowSelect = (index) => {
    setSelectedRows((prevSelectedRows) => {
      const newSelectedRows = prevSelectedRows.includes(index)
        ? prevSelectedRows.filter((rowIndex) => rowIndex !== index)
        : [...prevSelectedRows, index];
      onRowSelectChange(newSelectedRows);
      return newSelectedRows;
    });
  };

  // Apply filtering and sorting
  let filteredData = data.filter((row) =>
    columns.every(({ value }) => {
      if (!filterValues[value]) return true;
      const val = getValue(row, value, signalSource);
      return val?.toString().toLowerCase().includes(filterValues[value].toLowerCase());
    })
  );

  if (sortConfig.key) {
    filteredData = filteredData.sort((a, b) => {
      const valA = getValue(a, sortConfig.key, signalSource);
      const valB = getValue(b, sortConfig.key, signalSource);
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // CSV download
  const downloadSelectedRows = () => {
    const header = columns.map((col) => col.label);
    const csvContent = [
      header.join(','),
      ...selectedRows.map((rowIndex) => {
        const row = data[rowIndex];
        return columns
          .map(({ value }) => {
            let cellValue = getValue(row, value, signalSource);
            if (value === 'timestamp') {
              cellValue = FormatDate(cellValue, currentUser.timezone);
            } else if (typeof cellValue === 'object') {
              cellValue = JSON.stringify(cellValue);
            }
            if (typeof cellValue === 'string' && (cellValue.includes(',') || cellValue.includes('"'))) {
              cellValue = `"${cellValue.replace(/"/g, '""')}"`;
            }
            return cellValue;
          })
          .join(',');
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
          <tr>
            <th className="selectHeader">Select</th>
            {columns.map(({ label, value }) => (
              <th
                key={value}
                ref={(el) => (columnRefs.current[value] = el)}
                style={{
                  width: columnWidths[value] || 'auto',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  height: '45px',
                  background: 'var(--tableDataHeaderBackground)',
                  borderRight: '1px solid var(--tableHeaderRowRightBorderColor)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {filterVisible[value] ? (
                    <input
                      type="text"
                      placeholder={`Filter ${label}`}
                      value={filterValues[value] || ''}
                      onChange={(e) => handleFilterChange(value, e.target.value)}
                      onBlur={() => toggleFilterVisibility(value)}
                      style={{
                        width: 'calc(100% - 60px)',
                        background: 'var(--contentBackground)',
                        border: 'none',
                        padding: '6px 4px',
                        borderRadius: '6px',
                        paddingLeft: '12px',
                        marginLeft: '10px',
                      }}
                    />
                  ) : (
                    <span onClick={() => toggleFilterVisibility(value)} className="headerText">
                      {label}
                    </span>
                  )}
                  <div className="headerIcons">
                    <span onClick={() => handleSort(value)}>
                      {sortConfig.key === value && sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />}
                    </span>
                    <span
                      className="resizeHandle"
                      style={{ marginRight: '10px' }}
                      onMouseDown={(e) => startResize(value, e)}
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
              <td className="checkbox-column" style={{ textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedRows.includes(index)}
                  onChange={() => handleRowSelect(index)}
                />
              </td>
              {columns.map(({ value }) => (
                <td
                  key={value}
                  style={{
                    width: columnWidths[value] || 'auto',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    height: '28px',
                    borderRight: '1px solid var(--tableDataRowRightBorderColor)',
                    textAlign: 'center',
                    fontSize: '14px',
                  }}
                >
                  {value === 'content' && typeof getValue(row, value, signalSource) === 'object'
                    ? JSON.stringify(getValue(row, value))
                    : getValue(row, value, signalSource)}
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
