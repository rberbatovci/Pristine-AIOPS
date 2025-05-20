import React, { useState } from 'react';
import { AiOutlineColumnWidth } from 'react-icons/ai';
import { RiZoomInLine, RiZoomInFill, RiZoomOutLine, RiZoomOutFill  } from "react-icons/ri";
import '../../css/SignalTimeline.css';
import sameDay from './timeline/sameDay';
import sameMonth from './timeline/sameMonth';
import differentMonths from './timeline/differentMonths';
import { FormatDate } from '../misc/FormatDate';

const Timeline = ({ currentUser, selectedIncident, events }) => {
  const [showData, setShowData] = useState(false);
  const [zoomCount, setZoomCount] = useState(1);

  const startTime = new Date(FormatDate(selectedIncident.startTime, currentUser.timezone));
  const endTime = selectedIncident.endTime
    ? new Date(FormatDate(selectedIncident.endTime, currentUser.timezone))
    : new Date(FormatDate(new Date(), currentUser.timezone));

  const startTimeYear = startTime.getFullYear();
  const startTimeMonth = startTime.getMonth() + 1;
  const startTimeDay = startTime.getDate();

  const endTimeYear = endTime.getFullYear();
  const endTimeMonth = endTime.getMonth() + 1;
  const endTimeDay = endTime.getDate();

  let RenderComponent;

  if (
    startTimeYear === endTimeYear &&
    startTimeMonth === endTimeMonth &&
    startTimeDay === endTimeDay
  ) {
    RenderComponent = sameDay;
  } else if (
    startTimeYear === endTimeYear &&
    startTimeMonth === endTimeMonth
  ) {
    RenderComponent = sameMonth;
  } else {
    RenderComponent = differentMonths;
  }

  const resetZoom = () => {
    setZoomCount(1);
  };

  const zoomIn = () => {
    setZoomCount((prev) => Math.max(prev + 0.1, 1));
  };

  const zoomOut = () => {
    setZoomCount((prev) => Math.max(prev - 0.1, 1));
  };

  return (
    <div className={`signalRightElementContainer ${showData ? 'expanded' : 'collapsed'}`}>
      <div className="signalRightElementHeader">
        <h2 className="signalRightElementHeaderTxt" onClick={() => setShowData(!showData)}>
          {showData ? '\u25CF' : '\u25CB'} Signal Timeline
        </h2>
        {showData && (
          <div className="zoom-buttons-container">
            <div className="headerButtons">
              <button className="iconButton" onClick={resetZoom}>
                <AiOutlineColumnWidth className="defaultIcon"/>
                <AiOutlineColumnWidth className="hoverIcon"/>
              </button>
              <button className="iconButton" onClick={zoomIn}>
                <RiZoomInLine className="defaultIcon"/>
                <RiZoomInFill className="hoverIcon"/>
              </button>
              <button className="iconButton" onClick={zoomOut}>
                <RiZoomOutLine className="defaultIcon"/>
                <RiZoomOutFill className="hoverIcon"/>
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="signal-timeline-content" style={{ margin: '10px'}}>
        {showData && <RenderComponent showData={showData} currentUser={currentUser} startTime={startTime} endTime={endTime} events={events} zoomCount={zoomCount}/>}
      </div>
    </div>
  );
};

export default Timeline;