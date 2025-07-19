import React, { useState, useEffect } from 'react';
import { DateRangePicker } from 'rsuite';
import '../../css/SearchTime.css';

const SearchTime = ({ onTimeRangeSelect, onTimeRangeChange }) => {
    const [activeRange, setActiveRange] = useState('last_1_hour');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    const handleTimeRangeSelect = (range) => {
        setActiveRange(range);
        onTimeRangeSelect(range);
    };

    const handleTimeRangeChange = (value) => {
        if (value) {
            const [start, end] = value;
            setStartDate(start);
            setEndDate(end);
            onTimeRangeChange(start, end);
        } else {
            setStartDate(null);
            setEndDate(null);
            onTimeRangeChange(null, null);
        }
    };

    return (
        <div className="dropdownConfigContainer" style={{ color: 'var(--textColor)', padding: '10px', width: 'auto', height: '150px' }}>
            <>
            <span >Select a timerange:</span>
            <div style={{backgroundColor: 'var(--backgroundColor3)', marginTop: '8px', padding: '8px', borderRadius: '8px'}}>
                <div className="button-group" >
                    {[
                        { label: '1 Hour', value: 'last_1_hour' },
                        { label: '4 Hours', value: 'last_4_hours' },
                        { label: '8 Hours', value: 'last_8_hours' },
                        { label: '12 Hours', value: 'last_12_hours' },
                        { label: 'Today', value: 'today' },
                        { label: 'This Month', value: 'this_month' }
                    ].map(({ label, value }) => (
                        <button
                            key={value}
                            className={`signalTagItemX ${activeRange === value ? 'selected' : ''}`}
                            onClick={() => handleTimeRangeSelect(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <div className="date-picker-container">
                    <DateRangePicker
                        format="MM/dd/yyyy HH:mm"
                        value={[startDate, endDate]}
                        onChange={handleTimeRangeChange}
                        placement="bottomEnd"
                        style={{
                            width: 'calc(100% - 20px)',
                            background: 'var(--signalRightElementHeaderBackground)',
                            color: 'var(--textColor)',
                            borderRadius: '8px',
                            border: '1px solid var(--borderColor)',
                            padding: '8px'
                        }}
                    />
                </div>
            </div></>
            
        </div>
    );
};

export default SearchTime;
