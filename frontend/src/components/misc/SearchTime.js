import React, { useRef, useState } from 'react';
import { useDateRangePickerState } from 'react-stately';
import { useDateRangePicker } from 'react-aria'; // useButton and useFocusRing are often handled by DateRangePicker directly
import { ZonedDateTime, getLocalTimeZone, today, CalendarDate } from '@internationalized/date';
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
    { label: '1 Hour', value: 'last_1_hour' },
    { label: '4 Hours', value: 'last_4_hours' },
    { label: '8 Hours', value: 'last_8_hours' },
    { label: '12 Hours', value: 'last_12_hour' }, // Typo fixed: last_12_hours
    { label: 'Today', value: 'today' },
];

const SearchTime = ({ onTimeRangeSelect, onTimeRangeChange }) => {
    // State for react-stately DateRangePicker
    const [dateRange, setDateRange] = useState({
        start: null,
        end: null
    });

    const state = useDateRangePickerState({
        value: dateRange,
        onChange: (newValue) => {
            setDateRange(newValue);
            // Propagate the change to parent component if needed
            if (onTimeRangeChange) {
                const startDate = newValue.start ? newValue.start.toDate(getLocalTimeZone()) : null;
                const endDate = newValue.end ? newValue.end.toDate(getLocalTimeZone()) : null;
                onTimeRangeChange(startDate, endDate);
            }
        },
        // Optionally set default values or constraints
        // minValue: today(getLocalTimeZone()),
        // maxValue: today(getLocalTimeZone()).add({ months: 6 }),
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


    // State for active predefined range (if you want to link it)
    const [activeRange, setActiveRange] = useState('last_1_hour');

    const handleTimeRangeSelect = (range) => {
        setActiveRange(range);
        onTimeRangeSelect(range);

        // Optional: Update the date picker based on predefined range
        const now = today(getLocalTimeZone());
        let startDate = null;
        let endDate = null;

        switch (range) {
            case 'last_1_hour':
                // For simplicity, defining as start of today to start of today + 1 hour.
                // In a real app, you'd calculate exact time relative to now.
                startDate = now.set({ hour: now.hour - 1 });
                endDate = now;
                break;
            case 'last_4_hours':
                startDate = now.set({ hour: now.hour - 4 });
                endDate = now;
                break;
            case 'last_8_hours':
                startDate = now.set({ hour: now.hour - 8 });
                endDate = now;
                break;
            case 'last_12_hour': // Fixed typo
                startDate = now.set({ hour: now.hour - 12 });
                endDate = now;
                break;
            case 'today':
                startDate = now.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
                endDate = now.set({ hour: 23, minute: 59, second: 59, millisecond: 999 });
                break;
            default:
                break;
        }

        // Update the date picker state if a predefined range is selected
        if (startDate && endDate) {
            setDateRange({ start: startDate, end: endDate });
            if (onTimeRangeChange) {
                onTimeRangeChange(startDate.toDate(getLocalTimeZone()), endDate.toDate(getLocalTimeZone()));
            }
        } else {
            setDateRange({ start: null, end: null }); // Clear if no specific range
            if (onTimeRangeChange) {
                onTimeRangeChange(null, null);
            }
        }
    };


    return (
        <div className="signalTagContainer">
            <>
                <span>Select a timerange:</span>
                <div style={{ backgroundColor: 'var(--backgroundColor3)', marginTop: '8px', padding: '10px', borderRadius: '8px'}}>
                    <div className="button-group" >
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
                        {/* Use DateRangePicker component from react-aria-components */}
                        <DateRangePicker
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
                                                flex: 1, // take remaining space
                                                borderRadius: 8,
                                                padding: 8,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                color: 'var(--textColor)',
                                                backgroundColor: 'var(--buttonBackground)',
                                                width: 'calc(100% - 20px)', // Adjust width to fit within container
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
                                                style={{ padding: '12px 42px', marginLeft: '10px'}}
                                                className='button save-button'
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
                                                                        ? 'rgba(100, 149, 237, 0.25)' // hover background
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