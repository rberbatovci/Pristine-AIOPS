import React, { useState, useEffect } from 'react';
import '../../../css/SignalTimeline.css';
import { FormatDate } from '../../misc/FormatDate';

const DifferentMonths = ({ currentUser, startTime, endTime, events, zoomCount }) => {
  const [totalHoursCount, setTotalHoursCount] = useState(0);
  const [hourWidth, setHourWidth] = useState(0);

  useEffect(() => {
    const calculateTotalHours = () => {
      return (endTime - startTime) / (1000 * 60 * 60);
    };

    const totalHours = calculateTotalHours();
    setTotalHoursCount(totalHours);

    const timeContainer = document.getElementById('time');
    if (timeContainer && totalHours > 0) {
      const calculatedHourWidth = (timeContainer.offsetWidth / totalHours) * Math.pow(1.2, zoomCount);
      setHourWidth(calculatedHourWidth);
    }
  }, [startTime, endTime, zoomCount]);

  useEffect(() => {
    createTimeline();
    createEvents(events);
  }, [startTime, endTime, events]);

  const createEvents = (events) => {
    const eventsContainer = document.getElementById('eventsContainer');

    // Clear existing events
    eventsContainer.innerHTML = '';

    events.forEach((event) => {
      const eventButton = document.createElement('div');
      eventButton.className = 'eventButton';
      eventButton.style.position = 'absolute';

      // Calculate left position
      const eventLeftPosition = calculateLeftPosition(new Date(event.timestamp), hourWidth);
      eventButton.style.left = `${eventLeftPosition}px`;

      // Adjust the top position to align visually with the timeline
      eventButton.style.top = '10px'; // Modify as per your alignment needs

      // Tooltip for event details
      eventButton.title = `${event.device} - ${event.message}`;

      // Add event button to container
      eventsContainer.appendChild(eventButton);
    });
  };

  const syncContainerWidths = () => {
    const time = document.getElementById('time');
    const eventsContainer = document.getElementById('eventsContainer');
    if (time && eventsContainer) {
      eventsContainer.style.width = `${time.offsetWidth}px`;
    }
  };

  const createTimeline = () => {
    const time = document.getElementById('time');
    if (!time) return; // Ensure element exists before proceeding

    time.innerHTML = '';
    console.log('startTime and endTime in DifferentMonths component:', startTime, endTime);

    let totalHoursCount = 0;
    let hourDivs = [];
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayElement = document.createElement('div');
      const dayText = document.createElement('div');

      const hoursContainer = document.createElement('div');
      dayElement.appendChild(hoursContainer);
      dayElement.appendChild(dayText);

      const formattedDateString = currentDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
      });
      dayText.innerText = formattedDateString;
      dayElement.style.display = 'block';
      dayText.className = 'dayText';
      time.appendChild(dayElement);

      let startLoopHour = 0;
      let endLoopHour = 23;

      if (currentDate.toDateString() === startDate.toDateString()) {
        startLoopHour = startDate.getHours();
      }

      if (currentDate.toDateString() === endDate.toDateString()) {
        endLoopHour = endDate.getHours();
      }

      hoursContainer.style.display = 'flex';
      for (let hour = startLoopHour; hour <= endLoopHour; hour++) {
        const hourDiv = document.createElement('div');
        const hourText = document.createElement('div');
        const formattedHour = hour.toString().padStart(2, '0');
        hourText.innerText = `${formattedHour}:00`;
        hourText.className = 'hourText';

        const minContainer = document.createElement('div');
        minContainer.id = `minContainer-${hour}`;
        minContainer.style.display = 'flex';
        minContainer.style.position = 'relative';

        hourDiv.className = 'hourDiv';
        hourDiv.appendChild(minContainer);
        hourDiv.appendChild(hourText);
        hourDiv.id = `hour-${hour}`;

        hoursContainer.appendChild(hourDiv);
        totalHoursCount++;

        hourDivs.push({ hourDiv, hourText, hour, minContainer });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Ensure totalHoursCount is not zero
    if (totalHoursCount === 0) return;

    // Calculate default hour width based on timeline container width
    const containerWidth = time.offsetWidth;
    let hourWidth = containerWidth / totalHoursCount;

    // Apply zoom factor
    const zoomFactor = Math.pow(1.2, zoomCount);
    hourWidth *= zoomFactor;

    console.log(`Calculated hour width: ${hourWidth}`);

    const addMinutes = (minContainer, hourWidth, hour) => {
      minContainer.innerHTML = '';

      let interval = 1;
      let minStep = 10;
      if (hourWidth < 200) {
        interval = 60;
      } else if (hourWidth < 300) {
        interval = 30;
        minStep = 5;
      } else if (hourWidth < 400) {
        interval = 15;
        minStep = 5;
      } else if (hourWidth < 500) {
        interval = 10;
        minStep = 1;
      } else {
        interval = 5;
        minStep = 1;
      }

      for (let min = 0; min < 60; min += minStep) {
        const minDiv = document.createElement('div');
        minDiv.className = 'minDiv';

        if (min % interval === 0) {
          const minText = document.createElement('div');
          minText.innerText = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          minText.style.position = 'absolute';
          minText.style.top = '10px';
          minText.style.marginLeft = '-15px';
          minDiv.style.height = '5px';
          minDiv.style.opacity = '.6';
          minDiv.appendChild(minText);
        }

        if (min === 0) {
          minDiv.style.opacity = '0';
          minDiv.style.borderLeft = 'none';
        }
        minContainer.appendChild(minDiv);
      }
    };

    hourDivs.forEach(({ hourDiv, hourText, minContainer, hour }) => {
      hourDiv.style.width = `${hourWidth}px`;
      hourText.style.maxWidth = `${hourWidth}px`;
      hourText.style.overflow = 'hidden';
      hourText.style.whiteSpace = 'nowrap';
      hourText.style.textOverflow = 'ellipsis';

      // Adjust visibility based on zoom level
      if (hourWidth > 40) {
        hourText.style.display = 'block';
      } else if (hourWidth > 20) {
        hourText.style.display = hour % 4 === 0 ? 'block' : 'none';
      } else if (hourWidth > 10) {
        hourText.style.display = hour % 8 === 0 ? 'block' : 'none';
      } else {
        hourText.style.display = hour % 12 === 0 ? 'block' : 'none';
      }

      // Add minute markers based on hourWidth
      addMinutes(minContainer, hourWidth, hour);
    });

    const syslogDetails = document.getElementById('signal-timeline-details');
    if (syslogDetails) {
      syslogDetails.style.width = `${time.offsetWidth}px`;
    }
  };

  const calculateLeftPosition = (eventTimestamp, hourWidth) => {
    const startDate = new Date(startTime);
    const eventDate = new Date(FormatDate(eventTimestamp, currentUser.timezone));
    const hourDifference = (eventDate - startDate) / (1000 * 60 * 60);

    // Return pixel position
    return hourDifference * hourWidth;
  };

  return (
    <div className="signal-timeline-details" id="signal-timeline-details">
      <div style={{ display: 'column' }}>
        <div className="timelineContainer">
          <div id="eventsContainer"></div>
          <div className="timeContainer" id="time"></div>
        </div>
      </div>
    </div>
  );
};

export default DifferentMonths;