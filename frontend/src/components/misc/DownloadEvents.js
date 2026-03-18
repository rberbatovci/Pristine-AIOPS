  // CSV Download
  const downloadSelectedRows = () => {
    const header = columns.map((col) => col.label);

    const csvContent = [
      header.join(','),
      ...selectedRows.map((rowIndex) => {
        const row = filteredData[rowIndex];

        return columns
          .map(({ value }) => {
            let cellValue = getValue(row, value);

            if (value === 'timestamp') {
              cellValue = FormatDate(cellValue, currentUser.timezone);
            }

            if (typeof cellValue === 'object') {
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
    link.href = url;
    link.download = 'selected_rows.csv';
    link.click();
  };

  useEffect(() => {
    if (onDownload) onDownload(downloadSelectedRows);
  }, [selectedRows, filteredData]);