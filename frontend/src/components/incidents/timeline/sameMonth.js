import React, { useState, useEffect, useRef } from 'react';
import '../../../css/SignalTimeline.css';
import { FormatDate } from '../../misc/FormatDate';

const SameMonth = ({ currentUser, startTime, endTime, events, zoomCount }) => {
  const [totalHours, setTotalHours] = useState(0);
  const [hourWidth, setHourWidth] = useState(0);
  const [eventPositions, setEventPositions] = useState([]);
  const [rangeBars, setRangeBars] = useState([]);
  const [timeContainerWidth, setTimeContainerWidth] = useState(null);
  const timelineContainerRef = useRef(null);
  const isInitialRender = useRef(true); // Track initial render

  useEffect(() => {
      const time = document.getElementById('timelineContainer');
      if (time) {
        setTimeContainerWidth(time.offsetWidth);
        console.log('Time offset width in sameDay:', time.offsetWidth);
      }
    }, []);

  useEffect(() => {
    console.log('Hour width in sameDay:', hourWidth);
  }, [hourWidth]);

  useEffect(() => {
    console.log('Total hours in sameDay:', totalHours);
  }, [totalHours]);

  // Calculate total hours only once when startTime and endTime are available
  useEffect(() => {
    if (startTime && endTime) {
      const calculateTotalHours = () => {
        const startTimestamp = startTime.getTime();
        const endTimestamp = endTime.getTime();
        const totalHours = (endTimestamp - startTimestamp) / (1000 * 60 * 60);
        return Math.ceil(totalHours);
      };
      const countedHours = calculateTotalHours();
      setTotalHours(countedHours);
    }
  }, [startTime, endTime]);

  // Calculate hourWidth only once when totalHours and timeContainerWidth are available
  useEffect(() => {
    if (totalHours > 0 && timeContainerWidth > 0) {
      const width = timeContainerWidth / totalHours;
      setHourWidth(width - 4);
    }
  }, [totalHours, timeContainerWidth]);

  // Create timeline and events only when hourWidth is calculated
  useEffect(() => {
    if (hourWidth > 0) {
      createTimeline();
      createEvents(events);
    }
  }, [hourWidth, startTime, endTime, zoomCount, events]);

  // Create events
  const createEvents = () => {
    if (hourWidth > 0) {
      const newPositions = events.map((event) => {
        const left = calculateLeftPosition(new Date(event.timestamp), hourWidth);
        return { ...event, left };
      });
      const newRangeBars = events.map((event, index) => {
        const left = calculateLeftPosition(new Date(event.timestamp), hourWidth);
        const nextEvent = events[index + 1];
        const nextLeft = nextEvent
          ? calculateLeftPosition(new Date(nextEvent.timestamp), hourWidth)
          : calculateLeftPosition(new Date(), hourWidth);
        const width = nextLeft - left;
        return { ...event, left, width };
      });

      setEventPositions(newPositions);
      setRangeBars(newRangeBars);
    }
  };

  // Add minutes to the timeline
  const addMinutes = (minContainer, hourWidth, hour) => {
    minContainer.innerHTML = '';
    minContainer.style.position = 'relative';
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

  // Create the timeline
  const createTimeline = () => {
    const time = document.getElementById('time');
    if (!time) {
      console.log('No time element!');
      return;
    }

    time.innerHTML = '';
    const daysContainer = document.createElement('div');
    daysContainer.style.display = 'flex';
    let totalHoursCount = 0;
    const startDay = startTime.getDate();
    const endDay = endTime.getDate();
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    let hourDivs = [];

    // Calculate adjustedHourWidth based on zoomCount
    const zoomFactor = Math.pow(1.2, zoomCount);
    const adjustedHourWidth = hourWidth * zoomFactor;

    for (let dayIndex = startDay; dayIndex <= endDay; dayIndex++) {
      const dayContainer = document.createElement('div');
      const dayText = document.createElement('div');
      const hoursContainer = document.createElement('div');
      dayContainer.className = 'dayContainer';
      dayContainer.appendChild(hoursContainer);
      dayContainer.appendChild(dayText);
      const formattedDate = new Date(startTime);
      formattedDate.setDate(formattedDate.getDate() + dayIndex - startDay);
      const formattedDateString = formattedDate.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
      });
      dayText.innerText = formattedDateString;
      dayContainer.style.display = 'block';
      dayText.className = 'dayText';
      daysContainer.appendChild(dayContainer);

      let startLoopHour = 0;
      let endLoopHour = 23;
      if (dayIndex === startDay) {
        startLoopHour = startHour;
      }
      if (dayIndex === endDay) {
        endLoopHour = endHour;
      }
      hoursContainer.style.display = 'flex';

      for (let hour = startLoopHour; hour <= endLoopHour; hour++) {
        const hourDiv = document.createElement('div');
        const hourText = document.createElement('div');
        const formattedHour = hour.toString().padStart(2, '0');
        hourText.innerText = `${formattedHour}:00`;
        hourText.className = 'hourText';
        hourDiv.className = 'hourDiv';
        hourDiv.id = `hour-${hour}`;
        hourDiv.appendChild(hourText);
        hoursContainer.appendChild(hourDiv);
        totalHoursCount++;

        if (adjustedHourWidth > 40) {
          const minContainer = document.createElement('div');
          minContainer.id = `minContainer-${hour}`;
          minContainer.style.display = 'flex';
          minContainer.style.position = 'relative';
          hourDiv.appendChild(minContainer);
          hourDivs.push({ hourDiv, hourText, hour, minContainer });
        } else {
          hourDivs.push({ hourDiv, hourText, hour });
        }
      }
    }

    time.appendChild(daysContainer);

    if (totalHoursCount === 0) return;

    // Update hourDiv widths and handle minute containers
    hourDivs.forEach(({ hourDiv, hourText, minContainer, hour }) => {
      hourDiv.style.width = `${adjustedHourWidth}px`;
      hourDiv.style.boxSizing = 'border-box';

      if (adjustedHourWidth > 40) {
        hourText.style.display = 'block';
        hourDiv.style.display = 'block';
        if (minContainer) {
          addMinutes(minContainer, adjustedHourWidth, hour);
        }
      } else if (adjustedHourWidth > 20) {
        hourText.style.display = hour % 4 === 0 ? 'block' : 'none';
      } else if (adjustedHourWidth > 10) {
        hourText.style.display = hour % 8 === 0 ? 'block' : 'none';
      } else {
        hourText.style.display = hour % 12 === 0 ? 'block' : 'none';
      }
    });

    const syslogDetails = document.getElementById('signal-timeline-details');
    if (syslogDetails) {
      syslogDetails.style.width = `${time.offsetWidth}px`;
    }
  };

  // Calculate left position for events
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
        <div className="timelineContainer" id="timelineContainer">
          <div
            id="eventsContainer"
            style={{
              width: timeContainerWidth,
              position: 'relative',
              height: '80px',
            }}
          >
            {rangeBars.map((event, index) => (
              <div
                key={index}
                className="rangeBar"
                style={{
                  position: 'absolute',
                  left: `${event.left}px`,
                  top: '25px',
                  backgroundColor: 'rgba(0, 0, 255, 0.5)',
                  width: `${event.width}px`,
                  height: '40px',
                  borderRadius: '5px',
                  zIndex: '7',
                }}
                title={`${event.device} - ${event.timestamp} - ${event.message}`}
              ></div>
            ))}
            {eventPositions.map((event, index) => (
              <div
                key={index}
                className="eventButton"
                style={{
                  position: 'absolute',
                  left: `${event.left}px`,
                  top: '30px',
                  backgroundColor: 'red',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  zIndex: '8',
                }}
                title={`${event.device} - ${event.timestamp} - ${event.message}`}
              ></div>
            ))}
          </div>
          <div className="timeContainer" id="time" style={{ width: timeContainerWidth }}></div>
        </div>
      </div>
    </div>
  );
};

export default SameMonth;