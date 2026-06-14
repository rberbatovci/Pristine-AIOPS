import React, { useEffect, useRef, useState } from 'react';
import { useDateRangePickerState } from 'react-stately';
import { useDateRangePicker } from 'react-aria';
import {
    getLocalTimeZone,
    today,
    fromDate,
    toCalendarDateTime
} from '@internationalized/date';

import {
    DateRangePicker,
    DateInput,
    DateSegment,
    Group,
    Button,
    RangeCalendar,
    CalendarGrid,
    CalendarCell,
    Heading,
} from 'react-aria-components';

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const predefinedRanges = [
    { label: 'Last 1 Hour', value: '1' },
    { label: 'Last 4 Hours', value: '4' },
    { label: 'Last 8 Hours', value: '8' },
    { label: 'Last 12 Hours', value: '12' },
    { label: 'Today', value: 'today' },
    { label: 'Custom Range', value: 'custom' }
];

const SearchTime = ({ startTime, endTime, onTimeRangeChange }) => {
    const [dateRange, setDateRange] = useState({
        start: null,
        end: null
    });

    const [hoveredDate, setHoveredDate] = useState(null);
    const [activeRange, setActiveRange] = useState('1');

    const ref = useRef();

    const state = useDateRangePickerState({
        value: dateRange,
        onChange: (newValue) => {
            setDateRange(newValue);
        },
    });

    useDateRangePicker({
        label: 'Date Range',
        value: dateRange,
        onChange: (newValue) => {
            setDateRange(newValue);

            if (onTimeRangeChange) {
                const startDate = newValue.start
                    ? newValue.start.toDate(getLocalTimeZone())
                    : null;

                const endDate = newValue.end
                    ? newValue.end.toDate(getLocalTimeZone())
                    : null;

                onTimeRangeChange(startDate, endDate);
            }
        },
    }, state, ref);

    const handleTimeRangeSelect = (value) => {
        setActiveRange(value);

        if (value === 'custom') {
            return;
        }

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

        setDateRange({
            start: newStart,
            end: newEnd
        });

        if (onTimeRangeChange) {
            onTimeRangeChange(
                newStart.toDate(),
                newEnd.toDate()
            );
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
        handleTimeRangeSelect('1');
    }, []);

    return (
        <div className="signalTagContainer">
            <span>Select a timerange:</span>

            <div
                style={{
                    backgroundColor: 'var(--backgroundColor3)',
                    marginTop: '8px',
                    padding: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}
            >
                {/* Dropdown */}
                <select
                    value={activeRange}
                    onChange={(e) => handleTimeRangeSelect(e.target.value)}
                    style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'var(--buttonBackground)',
                        color: 'var(--textColor)',
                        fontSize: '14px',
                        width: '100%'
                    }}
                >
                    {predefinedRanges.map(({ label, value }) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>

                {/* Custom Date Range Picker */}
                <DateRangePicker
                    format="yyyy-MM-dd HH:mm"
                    value={dateRange}
                    onChange={setDateRange}
                    granularity="minute"
                    aria-label="Select date and time range"
                >
                    {(state) => (
                        <>
                            <Group
                                style={{
                                    width: '100%',
                                    borderRadius: 8,
                                    padding: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    color: 'var(--textColor)',
                                    backgroundColor: 'var(--buttonBackground)',
                                }}
                            >
                                <DateInput
                                    slot="start"
                                    {...state.startFieldProps}
                                    style={{ textAlign: 'right' }}
                                >
                                    {(segment) => (
                                        <DateSegment segment={segment} />
                                    )}
                                </DateInput>

                                <span
                                    aria-hidden="true"
                                    style={{ fontWeight: 'bold' }}
                                >
                                    –
                                </span>

                                <DateInput
                                    slot="end"
                                    {...state.endFieldProps}
                                >
                                    {(segment) => (
                                        <DateSegment segment={segment} />
                                    )}
                                </DateInput>

                                <Button
                                    {...state.toggleButtonProps}
                                    aria-label="Toggle calendar"
                                >
                                    <ChevronDown size={18} />
                                </Button>
                            </Group>

                            {/* Calendar Popup */}
                            {state.isOpen && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        padding: 8,
                                        borderRadius: 8,
                                        color: 'var(--textColor)',
                                        backgroundColor:
                                            'var(--backgroundColor2)'
                                    }}
                                >
                                    <RangeCalendar
                                        style={{ width: '100%' }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent:
                                                    'space-between',
                                                marginBottom: 12
                                            }}
                                        >
                                            <Button slot="previous">
                                                <ChevronLeft size={20} />
                                            </Button>

                                            <Heading
                                                style={{
                                                    fontSize: 18,
                                                    fontWeight: 'bold',
                                                    textAlign: 'center',
                                                    flex: 1
                                                }}
                                            />

                                            <Button slot="next">
                                                <ChevronRight size={20} />
                                            </Button>
                                        </div>

                                        <CalendarGrid>
                                            {(date) => (
                                                <CalendarCell
                                                    date={date}
                                                    onMouseEnter={() =>
                                                        setHoveredDate(date)
                                                    }
                                                    onMouseLeave={() =>
                                                        setHoveredDate(null)
                                                    }
                                                    style={{
                                                        borderRadius: 4,
                                                        padding: 8,
                                                        margin: 2,
                                                        cursor: 'pointer',
                                                        backgroundColor:
                                                            hoveredDate &&
                                                            hoveredDate
                                                                .toDate()
                                                                .toDateString() ===
                                                                date
                                                                    .toDate()
                                                                    .toDateString()
                                                                ? 'rgba(100,149,237,0.25)'
                                                                : 'var(--buttonBackground)',
                                                    }}
                                                />
                                            )}
                                        </CalendarGrid>
                                    </RangeCalendar>
                                </div>
                            )}

                            {/* Search Button */}
                            <button
                                style={{
                                    padding: '12px',
                                    width: '100%'
                                }}
                                className="button save-button"
                                onClick={handleSearch}
                            >
                                Search
                            </button>
                        </>
                    )}
                </DateRangePicker>
            </div>
        </div>
    );
};

export default SearchTime;