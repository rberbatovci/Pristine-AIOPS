import React, { useEffect, useState, useRef } from 'react';
import '../../../css/SignalTimeline.css';
import { FormatDate } from '../../misc/FormatDate';

const SameDay = ({ currentUser, selectedSignal, startTime, endTime, events, zoomCount }) => {
  const [hourWidth, setHourWidth] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [eventPositions, setEventPositions] = useState([]);
  const [rangeBars, setRangeBars] = useState([]);
  const [timeContainerWidth, setTimeContainerWidth] = useState(null);
  const timeRef = useRef(null);

  const zoomFactor = Math.pow(1, zoomCount);
  const adjustedHourWidth = hourWidth * zoomFactor;

  console.log('Signal events in sameDay', events);

  useEffect(() => {
    const measureWidth = () => {
      if (timeRef.current?.offsetWidth) {
        setTimeContainerWidth(timeRef.current.offsetWidth);
      } else {
        console.warn('⚠️ timeContainerWidth not found, using fallback 400px');
        setTimeContainerWidth(820); // fallback
      }
    };

    // Try immediately
    measureWidth();

    // Try again after the DOM paints
    const retry = setTimeout(measureWidth, 50);

    return () => clearTimeout(retry);
  }, []);

  useEffect(() => {
    if (startTime && endTime) {
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);
      const startHour = startDate.getHours();
      const endHour = endDate.getHours();
      const countedHours = endHour - startHour + 1;
      setTotalHours(countedHours);
    } else {
      console.log('No startTime or endTime');
    }
  }, [startTime, endTime]);

  useEffect(() => {
    if (timeContainerWidth !== null && totalHours > 0) {
      const width = timeContainerWidth / totalHours;
      console.log('✅ timeContainerWidth:', timeContainerWidth);
      console.log('✅ totalHours:', totalHours);
      console.log('✅ Calculated width:', width);
      setHourWidth(width);
    }
  }, [timeContainerWidth, totalHours]);

  useEffect(() => {
    if (hourWidth > 0) {
      generateTimeline(hourWidth);
      createEvents(hourWidth);
    }
  }, [hourWidth, totalHours, startTime, endTime, zoomCount, events]);

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
      hourDiv.style.width = `${hourWidth}px`;

      const minContainer = document.createElement('div');
      minContainer.className = 'minContainer';
      addMinutes(minContainer, hourWidth, hour);
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

  const createEvents = (hourWidthValue) => {
    const zoomFactor = Math.pow(1, zoomCount);
    const adjustedWidth = hourWidthValue * zoomFactor;

    if (adjustedWidth > 0 && events.length > 1) {
      const newPositions = events.map((event) => {
        const left = calculateLeftPosition(
          new Date(event['timestamp']),
          adjustedWidth
        );
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

  const calculateLeftPosition = (eventTimestamp, adjustedWidth) => {
    if (!adjustedWidth) return 0;

    const startDate = new Date(startTime);
    const eventDate = new Date(
      FormatDate(eventTimestamp, currentUser.timezone)
    );

    const eventHour = eventDate.getHours();
    const eventMinute = eventDate.getMinutes();
    const eventSecond = eventDate.getSeconds();
    const startHour = startDate.getHours();

    return (

      (eventMinute * adjustedWidth) / 60 +
      (eventSecond * adjustedWidth) / 3600
    );
  };

  return (
    <div className="signal-timeline-details" id="signal-timeline-details">
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        <div className="timelineContainer" id="timelineContainer" ref={timeRef}>
          <div
            id="eventsContainer"
            style={{
              width: '100%',
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
          <div className="timeContainer" id="time" style={{ width: `${timeContainerWidth}px` }}></div>
        </div>
      </div>
    </div>
  );
};

export default SameDay;
