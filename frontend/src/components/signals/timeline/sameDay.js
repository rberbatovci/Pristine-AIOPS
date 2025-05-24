import React, { useEffect, useState, useRef } from 'react';
import '../../../css/SignalTimeline.css';
import { FormatDate } from '../../misc/FormatDate';

const SameDay = ({ showData, currentUser, startTime, endTime, events, zoomCount }) => {
  const [hourWidth, setHourWidth] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [eventPositions, setEventPositions] = useState([]);
  const [rangeBars, setRangeBars] = useState([]);
  const [timeContainerWidth, setTimeContainerWidth] = useState(null);
  const timeRef = useRef(null);

  const zoomFactor = Math.pow(1.2, zoomCount);
  const adjustedHourWidth = hourWidth * zoomFactor;

  useEffect(() => {
    const time = document.getElementById('timelineContainer');
    if (time) {
      setTimeContainerWidth(time.offsetWidth - 20);
    }
  }, []);

  useEffect(() => {
    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const startHour = startDate.getHours();
      const endHour = endDate.getHours();
      const countedHours = endHour - startHour + 1;
      setTotalHours(countedHours);
    }
  }, [startTime, endTime]);

  useEffect(() => {
    if (totalHours > 0 && timeContainerWidth) {
      const width = timeContainerWidth / totalHours;
      setHourWidth(width);
    }
  }, [totalHours, timeContainerWidth]);

  useEffect(() => {
    if (hourWidth > 0) {
      generateTimeline();
      createEvents();
    }
  }, [hourWidth, startTime, endTime, zoomCount, events]);

  const generateTimeline = () => {
    const time = document.getElementById('time');
    if (!time) return;
    time.innerHTML = '';

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const startHour = startDate.getHours();
    const endHour = endDate.getHours();

    const hoursContainer = document.createElement('div');
    hoursContainer.style.display = 'flex';

    for (let hour = startHour; hour <= endHour; hour++) {
      const hourDiv = document.createElement('div');
      hourDiv.className = 'hourDiv';
      hourDiv.style.width = `${adjustedHourWidth}px`;

      const minContainer = document.createElement('div');
      minContainer.className = 'minContainer';
      addMinutes(minContainer, adjustedHourWidth, hour);
      hourDiv.appendChild(minContainer);

      const hourText = document.createElement('div');
      hourText.innerText = `${hour.toString().padStart(2, '0')}:00`;
      hourText.className = 'hourText';
      hourDiv.appendChild(hourText);

      hoursContainer.appendChild(hourDiv);
    }

    time.appendChild(hoursContainer);

    const dayText = document.createElement('div');
    dayText.className = 'dayText';
    dayText.style.marginTop = '10px';
    dayText.innerText = startDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });

    time.appendChild(dayText);
  };

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
      minDiv.style.height = '10px';
      minDiv.style.opacity = '.6';

      if (min % interval === 0) {
        const minText = document.createElement('div');
        minText.innerText = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        minText.style.position = 'absolute';
        minText.style.top = '10px';
        minText.style.marginLeft = '-15px';
        minDiv.appendChild(minText);
      }

      if (min === 0) {
        minDiv.style.opacity = '0';
        minDiv.style.borderLeft = 'none';
      }
      minContainer.appendChild(minDiv);
    }
  };

  const createEvents = () => {
    if (adjustedHourWidth > 0 && events.length > 1) {
      const newPositions = events.map((event) => {
        const left = calculateLeftPosition(new Date(event['@timestamp']));
        return { ...event, left };
      });

      const newRangeBars = [];

      for (let i = 0; i < newPositions.length - 1; i++) {
        const current = newPositions[i];
        const next = newPositions[i + 1];
        const width = next.left - current.left;

        if (width > 0) {
          newRangeBars.push({
            ...current,
            width,
          });
        }
      }

      setEventPositions(newPositions);
      setRangeBars(newRangeBars);
    }
  };

  const calculateLeftPosition = (eventTimestamp) => {
    if (!adjustedHourWidth) return 0;

    const startDate = new Date(startTime);
    const eventDate = new Date(FormatDate(eventTimestamp, currentUser.timezone));

    const eventHour = eventDate.getHours();
    const eventMinute = eventDate.getMinutes();
    const eventSecond = eventDate.getSeconds();
    const startHour = startDate.getHours();

    return (
      (eventHour - startHour) * adjustedHourWidth +
      (eventMinute * adjustedHourWidth) / 60 +
      (eventSecond * adjustedHourWidth) / 3600
    );
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
                  left: `${event.left - 2}px`,
                  top: '25px',
                  backgroundColor: 'rgba(31, 155, 0, 0.5)',
                  width: `${event.width}px`,
                  height: '40px',
                  borderRadius: '5px',
                  border: '1px solid rgba(0, 78, 7, 0.5)',
                }}
                title={`${event.device} - ${event['@timestamp']} - ${event.message}`}
              ></div>
            ))}
            {eventPositions.map((event, index) => (
              <div
                key={index}
                className="eventButton"
                style={{
                  position: 'absolute',
                  left: `${event.left - 5}px`,
                  marginTop: '7px',
                  top: '30px',
                  backgroundColor: 'red',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  border: '1px solid rgba(90, 0, 0, 0.5)',
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

export default SameDay;
