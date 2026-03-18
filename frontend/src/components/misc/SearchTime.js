import React, { useEffect, useRef, useState } from 'react';
import { useDateRangePickerState } from 'react-stately';
import { useDateRangePicker } from 'react-aria'; // useButton and useFocusRing are often handled by DateRangePicker directly
import { now, ZonedDateTime, getLocalTimeZone, today, fromDate, CalendarDate, toCalendarDateTime } from '@internationalized/date';
import '../../css/SearchTime.css'; // Make sure your CSS variables are defined here or globally

// Import react-aria-components
import {
    DateRangePicker,
    DateInput,
    DateSegment,
    Group,
    Button,
    Popover,
    Dialog,
    RangeCalendar,
    CalendarGrid,
    CalendarCell,
    Heading,
} from 'react-aria-components';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const predefinedRanges = [
    { label: '1 Hour', value: '1' },
    { label: '4 Hours', value: '4' },
    { label: '8 Hours', value: '8' },
    { label: '12 Hours', value: '12' }, // Typo fixed: last_12_hours
    { label: 'Today', value: 'today' },
];

const SearchTime = ({ startTime, endTime, onTimeRangeChange }) => {
    // State for react-stately DateRangePicker
    const [dateRange, setDateRange] = useState({
        start: null,
        end: null
    });

    const state = useDateRangePickerState({
        value: dateRange,
        onChange: (newValue) => {
            setDateRange(newValue);
        },
    });
    const [hoveredDate, setHoveredDate] = useState(null);
    const ref = useRef(); // Ref for the main date range picker element

    const {
        groupProps,
        startInputProps,
        endInputProps,
        buttonProps,
        calendarProps,
        errorMessageProps,
        descriptionProps
    } = useDateRangePicker({
        label: 'Date Range', // Label for accessibility
        value: dateRange,
        onChange: (newValue) => {
            setDateRange(newValue);
            if (onTimeRangeChange) {
                const startDate = newValue.start ? newValue.start.toDate(getLocalTimeZone()) : null;
                const endDate = newValue.end ? newValue.end.toDate(getLocalTimeZone()) : null;
                onTimeRangeChange(startDate, endDate);
            }
        },
    }, state, ref);

    const [activeRange, setActiveRange] = useState('1');

    const handleTimeRangeSelect = (value) => {
        const nowZoned = fromDate(new Date(), getLocalTimeZone());
        let newStart = null;
        let newEnd = nowZoned;

        if (value === 'today') {
            const todayDate = today(getLocalTimeZone());
            newStart = toCalendarDateTime(todayDate, 0, 0);
        } else {
            const hours = parseInt(value, 10);
            newStart = nowZoned.subtract({ hours });
        }

        setDateRange({ start: newStart, end: newEnd });
        setActiveRange(value);

        if (onTimeRangeChange) {
            onTimeRangeChange(newStart.toDate(), newEnd.toDate());
        }
    };

    const handleSearch = () => {
        if (!dateRange?.start || !dateRange?.end) return;

        const startDate = dateRange.start.toDate(getLocalTimeZone());
        const endDate = dateRange.end.toDate(getLocalTimeZone());

        if (onTimeRangeChange) {
            onTimeRangeChange(startDate, endDate);
        }
    };

    useEffect(() => {
        handleTimeRangeSelect('1'); // Default to "Last 1 Hour"
    }, []);

    return (
        <div className="signalTagContainer">
            <>
                <span>Select a timerange:</span>
                <div style={{ backgroundColor: 'var(--backgroundColor3)', marginTop: '8px', padding: '10px', borderRadius: '8px' }}>
                    <div className="button-group">
                        {predefinedRanges.map(({ label, value }) => (
                            <button
                                key={value}
                                className={`signalTagItemX ${activeRange === value ? 'selected' : ''}`}
                                onClick={() => handleTimeRangeSelect(value)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div className="date-picker-container" style={{ marginTop: '10px', display: 'flex', alignItems: 'center' }}>
                        <DateRangePicker
                            format="yyyy-MM-dd HH:mm"
                            value={dateRange}
                            onChange={setDateRange}
                            granularity="minute"
                            aria-label="Select date and time range"
                            width="350px"
                            backgroundColor="var(--backgroundColor3)"
                        >
                            {(state) => (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <Group
                                            style={{
                                                flex: 1,
                                                borderRadius: 8,
                                                padding: 8,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                color: 'var(--textColor)',
                                                backgroundColor: 'var(--buttonBackground)',
                                                width: 'calc(100% - 20px)',
                                            }}
                                        >
                                            <DateInput slot="start" {...state.startFieldProps} style={{ textAlign: 'right' }}>
                                                {(segment) => <DateSegment segment={segment} />}
                                            </DateInput>

                                            <span aria-hidden="true" style={{ fontWeight: 'bold' }}>
                                                –
                                            </span>

                                            <DateInput slot="end" {...state.endFieldProps} >
                                                {(segment) => <DateSegment segment={segment} />}
                                            </DateInput>

                                            <Button {...state.toggleButtonProps} aria-label="Toggle calendar">
                                                <ChevronDown size={20} />
                                            </Button>
                                        </Group>

                                        {!state.isOpen && (
                                            <button
                                                style={{ padding: '12px 42px', marginLeft: '10px' }}
                                                className='button save-button'
                                                onClick={handleSearch}
                                            >
                                                Search
                                            </button>
                                        )}
                                    </div>
                                    {state.isOpen && (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                padding: 8,
                                                borderRadius: 8,
                                                color: 'var(--textColor)',
                                            }}
                                        >
                                            <RangeCalendar style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                                    <Button
                                                        slot="previous"
                                                        aria-label="Previous month"
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 6,
                                                            color: 'var(--textColor)',
                                                            transition: 'transform 0.2s ease',
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                                    >
                                                        <ChevronLeft size={20} />
                                                    </Button>

                                                    <Heading
                                                        style={{
                                                            fontSize: 18,
                                                            fontWeight: 'bold',
                                                            color: 'var(--textColor)',
                                                            flex: 1,
                                                            textAlign: 'center',
                                                        }}
                                                    />

                                                    <Button
                                                        slot="next"
                                                        aria-label="Next month"
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 6,
                                                            color: 'var(--textColor)',
                                                            transition: 'transform 0.2s ease',
                                                        }}
                                                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                                                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                                    >
                                                        <ChevronRight size={20} />
                                                    </Button>
                                                </div>

                                                <CalendarGrid>
                                                    {(date) => (
                                                        <CalendarCell
                                                            date={date}
                                                            onMouseEnter={() => setHoveredDate(date)}
                                                            onMouseLeave={() => setHoveredDate(null)}
                                                            style={{
                                                                borderRadius: 4,
                                                                padding: 8,
                                                                paddingLeft: 24,
                                                                paddingRight: 24,
                                                                margin: 2,
                                                                cursor: 'pointer',
                                                                userSelect: 'none',
                                                                backgroundColor:
                                                                    hoveredDate && hoveredDate?.toDate().toDateString() === date.toDate().toDateString()
                                                                        ? 'rgba(100, 149, 237, 0.25)'
                                                                        : 'var(--buttonBackground)',
                                                                transition: 'background-color 0.2s ease',
                                                                opacity: 0.7,
                                                            }}
                                                        />
                                                    )}
                                                </CalendarGrid>
                                            </RangeCalendar>
                                        </div>
                                    )}


                                </>
                            )}
                        </DateRangePicker>
                    </div>
                </div>
            </>
        </div>
    );
};

export default SearchTime;