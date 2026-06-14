import React from 'react';

export const FormatDate = ({ dateStr, timezone = 'UTC' }) => {
  if (!dateStr) return "";

  try {
    const date = new Date(dateStr);

    // Format options matching your UI tastes
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false // Or true if you want AM/PM
    }).format(date);

    return <span>{formattedDate}</span>;
  } catch (error) {
    console.error("Error formatting date:", error);
    return <span>{dateStr}</span>; // Fallback to raw string on error
  }
};