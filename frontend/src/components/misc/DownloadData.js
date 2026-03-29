export function downloadTableData({
    data,
    selectedRows = [],
    columns,
    fileName = "events.csv"
}) {
    if (!data || data.length === 0) return;

    // If selected rows exist → use them, otherwise use all data
    const rowsToDownload = selectedRows.length > 0 ? selectedRows : data;

    // Extract column keys
    const headers = columns.map(col => col.label);
    const keys = columns.map(col => col.value);

    // Build CSV content
    const csvContent = [
        headers.join(","), // header row
        ...rowsToDownload.map(row =>
            keys.map(key => {
                const value = row[key] ?? "";
                // Escape quotes
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(",")
        )
    ].join("\n");

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}