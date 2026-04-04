import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api, { getApiErrorMessage } from '../../utils/api';
import './Employee.css';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VIEW_OPTIONS = ['month', 'week', 'day'];
const EVENT_THEME = {
  present: { label: 'Present', className: 'calendar-event-present' },
  absent: { label: 'Absent', className: 'calendar-event-absent' },
  leave: { label: 'Leave', className: 'calendar-event-leave' },
  holiday: { label: 'Holiday', className: 'calendar-event-holiday' },
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatDateKey = (value) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (left, right) => formatDateKey(left) === formatDateKey(right);

const addDays = (value, days) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const hoursBetween = (start, end) => {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Number(Math.max(0, diff / (1000 * 60 * 60)).toFixed(2));
};

const formatTime = (value) => {
  if (!value) return '--';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getDateRange = (currentDate, view) => {
  if (view === 'day') {
    return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
  }

  if (view === 'week') {
    const start = startOfDay(addDays(currentDate, -currentDate.getDay()));
    return { start, end: endOfDay(addDays(start, 6)) };
  }

  const firstDay = startOfDay(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
  const gridStart = startOfDay(addDays(firstDay, -firstDay.getDay()));
  const gridEnd = endOfDay(addDays(gridStart, 41));
  return { start: gridStart, end: gridEnd };
};

const buildRangeDays = (currentDate, view) => {
  const { start, end } = getDateRange(currentDate, view);
  const days = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const getEventDetailLines = (event) => {
  const lines = [];

  if (event.meta?.status) lines.push(`Status: ${event.meta.status}`);
  if (event.meta?.checkIn) lines.push(`Check in: ${formatTime(event.meta.checkIn)}`);
  if (event.meta?.checkOut) lines.push(`Check out: ${formatTime(event.meta.checkOut)}`);
  if (event.meta?.leaveType) lines.push(`Leave type: ${event.meta.leaveType}`);
  if (event.meta?.holidayType) lines.push(`Holiday type: ${event.meta.holidayType}`);

  return lines;
};

const CalendarEventChip = ({ event, onOpen, onDragStart, onHover, onLeave }) => (
  <button
    type="button"
    className={`calendar-event-chip ${EVENT_THEME[event.eventType]?.className || ''} ${event.editable ? 'is-editable' : ''}`}
    draggable={event.editable}
    onClick={(e) => {
      e.stopPropagation();
      onOpen(event);
    }}
    onDragStart={(e) => onDragStart(e, event)}
    onMouseEnter={(e) => onHover(e, event)}
    onMouseMove={(e) => onHover(e, event)}
    onMouseLeave={onLeave}
    title={event.title}
  >
    <span className="calendar-event-dot"></span>
    <span className="calendar-event-text">{event.title}</span>
  </button>
);

const CalendarModal = ({ event, onClose }) => {
  if (!event) return null;

  return (
    <div className="calendar-modal-backdrop" onClick={onClose}>
      <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="calendar-modal-header">
          <div>
            <span className={`calendar-pill ${EVENT_THEME[event.eventType]?.className || ''}`}>
              {EVENT_THEME[event.eventType]?.label || 'Event'}
            </span>
            <h3>{event.title}</h3>
            <p>{new Date(event.start).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <button type="button" className="calendar-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="calendar-modal-body">
          <div className="calendar-modal-grid">
            <div className="calendar-modal-card">
              <span>Start</span>
              <strong>{formatTime(event.start)}</strong>
            </div>
            <div className="calendar-modal-card">
              <span>End</span>
              <strong>{formatTime(event.end)}</strong>
            </div>
            <div className="calendar-modal-card">
              <span>Total Hours</span>
              <strong>{event.meta?.totalHours ?? hoursBetween(event.meta?.checkIn, event.meta?.checkOut)} hrs</strong>
            </div>
            <div className="calendar-modal-card">
              <span>Owner</span>
              <strong>{event.meta?.employeeName || 'Self'}</strong>
            </div>
          </div>

          <div className="calendar-modal-details">
            <h4>Details</h4>
            <ul>
              {getEventDetailLines(event).map((line) => (
                <li key={line}>{line}</li>
              ))}
              {!getEventDetailLines(event).length ? <li>No additional details available.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const Calendar = () => {
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [holidayRecords, setHolidayRecords] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [draggingEvent, setDraggingEvent] = useState(null);

  const visibleDays = useMemo(() => buildRangeDays(currentDate, view), [currentDate, view]);
  const visibleRange = useMemo(() => getDateRange(currentDate, view), [currentDate, view]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, leavesRes, holidaysRes] = await Promise.all([
        api.get('/attendance'),
        api.get('/leaves'),
        api.get('/holidays'),
      ]);

      setAttendanceRecords(attendanceRes.data.data || []);
      setLeaveRecords(leavesRes.data.data || []);
      setHolidayRecords(holidaysRes.data.data || []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load calendar data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const events = useMemo(() => {
    const mapped = [];
    const attendanceDaySet = new Set();
    const leaveDaySet = new Set();
    const holidayDaySet = new Set();

    attendanceRecords.forEach((record) => {
      const date = startOfDay(record.date);
      const key = formatDateKey(date);
      attendanceDaySet.add(key);

      const status = record.status === 'Checked Out' ? 'present' : 'present';
      mapped.push({
        id: `attendance-${record._id}`,
        recordId: record._id,
        sourceType: 'attendance',
        eventType: status,
        title: record.status === 'Checked Out' ? 'Checked Out' : 'Present',
        start: record.checkIn || record.date,
        end: record.checkOut || record.checkIn || record.date,
        date,
        editable: true,
        meta: {
          status: record.status,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          totalHours: record.totalHours ?? record.workingHours ?? 0,
          employeeName: record.userId?.name || user?.name || 'Employee',
        },
      });
    });

    leaveRecords.forEach((record) => {
      const start = startOfDay(record.fromDate);
      const end = startOfDay(record.toDate);
      const cursor = new Date(start);

      while (cursor <= end) {
        leaveDaySet.add(formatDateKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      mapped.push({
        id: `leave-${record._id}`,
        recordId: record._id,
        sourceType: 'leave',
        eventType: 'leave',
        title: record.leaveType ? `${record.leaveType} Leave` : 'Leave',
        start,
        end,
        date: start,
        editable: true,
        meta: {
          status: record.status,
          leaveType: record.leaveType,
          employeeName: record.userId?.name || user?.name || 'Employee',
          reason: record.reason,
        },
      });
    });

    holidayRecords.forEach((record) => {
      const date = startOfDay(record.date);
      holidayDaySet.add(formatDateKey(date));

      mapped.push({
        id: `holiday-${record._id}`,
        recordId: record._id,
        sourceType: 'holiday',
        eventType: 'holiday',
        title: record.name,
        start: date,
        end: endOfDay(date),
        date,
        editable: user?.role === 'admin',
        meta: {
          holidayType: record.type,
          employeeName: 'Company',
        },
      });
    });

    visibleDays.forEach((day) => {
      const dayKey = formatDateKey(day);
      const isFuture = startOfDay(day) > startOfDay(new Date());
      const isWeekend = day.getDay() === 0;

      if (
        !isFuture
        && !isWeekend
        && !attendanceDaySet.has(dayKey)
        && !leaveDaySet.has(dayKey)
        && !holidayDaySet.has(dayKey)
      ) {
        mapped.push({
          id: `absent-${dayKey}`,
          recordId: dayKey,
          sourceType: 'system',
          eventType: 'absent',
          title: 'Absent',
          start: startOfDay(day),
          end: endOfDay(day),
          date: startOfDay(day),
          editable: false,
          meta: {
            status: 'Absent',
            employeeName: user?.name || 'Employee',
          },
        });
      }
    });

    return mapped.sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [attendanceRecords, leaveRecords, holidayRecords, user, visibleDays]);

  const eventsByDay = useMemo(() => {
    const eventMap = new Map();

    visibleDays.forEach((day) => {
      eventMap.set(formatDateKey(day), []);
    });

    events.forEach((event) => {
      const start = startOfDay(event.start);
      const end = startOfDay(event.end);
      const cursor = new Date(start);

      while (cursor <= end) {
        const key = formatDateKey(cursor);
        if (eventMap.has(key)) {
          eventMap.get(key).push(event);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return eventMap;
  }, [events, visibleDays]);

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (view === 'week') {
      return `${visibleDays[0]?.toLocaleDateString([], { day: 'numeric', month: 'short' })} - ${visibleDays[visibleDays.length - 1]?.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    return currentDate.toLocaleDateString([], { month: 'long', year: 'numeric' });
  }, [currentDate, view, visibleDays]);

  const changeRange = (direction) => {
    if (view === 'day') {
      setCurrentDate((prev) => addDays(prev, direction));
      return;
    }

    if (view === 'week') {
      setCurrentDate((prev) => addDays(prev, direction * 7));
      return;
    }

    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const handleDragStart = (e, event) => {
    if (!event.editable) return;
    setDraggingEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
  };

  const handleDropOnDate = async (date) => {
    if (!draggingEvent) return;

    setMoving(true);
    try {
      await api.patch(`/calendar/events/${draggingEvent.sourceType}/${draggingEvent.recordId}/move`, {
        date: startOfDay(date).toISOString(),
      });

      await fetchCalendarData();
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to move calendar event'));
    } finally {
      setMoving(false);
      setDraggingEvent(null);
    }
  };

  const openDaySummary = (date) => {
    const dayEvents = eventsByDay.get(formatDateKey(date)) || [];
    setSelectedEvent({
      title: `${date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} Summary`,
      start: date,
      end: date,
      eventType: dayEvents[0]?.eventType || 'holiday',
      meta: {
        status: dayEvents.length ? `${dayEvents.length} event(s)` : 'No scheduled items',
        employeeName: user?.name || 'Employee',
        checkIn: dayEvents.find((item) => item.meta?.checkIn)?.meta?.checkIn || null,
        checkOut: dayEvents.find((item) => item.meta?.checkOut)?.meta?.checkOut || null,
        totalHours: dayEvents.reduce((sum, item) => sum + (Number(item.meta?.totalHours) || 0), 0),
      },
    });
  };

  const renderMonthView = () => (
    <div className="calendar-month-shell">
      <div className="calendar-weekdays">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="calendar-weekday-cell">{day}</div>
        ))}
      </div>

      <div className="calendar-month-grid">
        {visibleDays.map((day) => {
          const dayKey = formatDateKey(day);
          const dayEvents = eventsByDay.get(dayKey) || [];
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dayKey}
              className={`calendar-day-card ${!isCurrentMonth ? 'is-muted' : ''} ${isToday ? 'is-today' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDropOnDate(day)}
              onClick={() => openDaySummary(day)}
            >
              <div className="calendar-day-header">
                <span className="calendar-day-number">{day.getDate()}</span>
                {dayEvents.length ? <span className="calendar-day-count">{dayEvents.length}</span> : null}
              </div>

              <div className="calendar-day-events">
                {dayEvents.slice(0, 3).map((event) => (
                  <CalendarEventChip
                    key={`${event.id}-${dayKey}`}
                    event={event}
                    onOpen={setSelectedEvent}
                    onDragStart={handleDragStart}
                    onHover={(e, hoveredEvent) => setTooltip({
                      event: hoveredEvent,
                      x: e.clientX + 14,
                      y: e.clientY + 14,
                    })}
                    onLeave={() => setTooltip(null)}
                  />
                ))}

                {dayEvents.length > 3 ? (
                  <button type="button" className="calendar-more-link" onClick={(e) => { e.stopPropagation(); openDaySummary(day); }}>
                    +{dayEvents.length - 3} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="calendar-week-board">
      {visibleDays.map((day) => {
        const dayKey = formatDateKey(day);
        const dayEvents = eventsByDay.get(dayKey) || [];
        const isToday = isSameDay(day, new Date());

        return (
          <div
            key={dayKey}
            className={`calendar-week-column ${isToday ? 'is-today' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnDate(day)}
          >
            <button type="button" className="calendar-week-column-head" onClick={() => openDaySummary(day)}>
              <span>{day.toLocaleDateString([], { weekday: 'short' })}</span>
              <strong>{day.getDate()}</strong>
            </button>
            <div className="calendar-week-column-body">
              {dayEvents.length ? dayEvents.map((event) => (
                <CalendarEventChip
                  key={`${event.id}-${dayKey}`}
                  event={event}
                  onOpen={setSelectedEvent}
                  onDragStart={handleDragStart}
                  onHover={(e, hoveredEvent) => setTooltip({
                    event: hoveredEvent,
                    x: e.clientX + 14,
                    y: e.clientY + 14,
                  })}
                  onLeave={() => setTooltip(null)}
                />
              )) : (
                <div className="calendar-empty-slot">No events</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDayView = () => {
    const day = visibleDays[0];
    const dayEvents = eventsByDay.get(formatDateKey(day)) || [];

    return (
      <div className="calendar-day-focus">
        <div className="calendar-day-focus-header">
          <h3>{day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          <span>{dayEvents.length} scheduled item(s)</span>
        </div>

        <div
          className="calendar-day-focus-list"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDropOnDate(day)}
        >
          {dayEvents.length ? dayEvents.map((event) => (
            <div key={event.id} className="calendar-focus-card">
              <div className="calendar-focus-time">
                <strong>{formatTime(event.start)}</strong>
                <span>{formatTime(event.end)}</span>
              </div>
              <div className="calendar-focus-body">
                <CalendarEventChip
                  event={event}
                  onOpen={setSelectedEvent}
                  onDragStart={handleDragStart}
                  onHover={(e, hoveredEvent) => setTooltip({
                    event: hoveredEvent,
                    x: e.clientX + 14,
                    y: e.clientY + 14,
                  })}
                  onLeave={() => setTooltip(null)}
                />
                <p>{event.meta?.reason || event.meta?.status || EVENT_THEME[event.eventType]?.label}</p>
              </div>
            </div>
          )) : (
            <div className="calendar-empty-panel">No attendance, leave, or holiday entries for this day.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in employee-page">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-title">Smart Calendar</h1>
          <p className="dashboard-subtitle">Attendance, leave, and holidays in one clean interactive workspace.</p>
        </div>
        <div className="calendar-toolbar">
          <div className="calendar-view-toggle">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`calendar-toggle-btn ${view === option ? 'is-active' : ''}`}
                onClick={() => setView(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="calendar-nav-controls">
            <button type="button" className="calendar-nav-btn" onClick={() => changeRange(-1)}>‹</button>
            <button type="button" className="calendar-today-btn" onClick={() => setCurrentDate(new Date())}>Today</button>
            <button type="button" className="calendar-nav-btn" onClick={() => changeRange(1)}>›</button>
          </div>
        </div>
      </div>

      <div className="calendar-shell glass-panel">
        <div className="calendar-shell-header">
          <div>
            <h2>{headerLabel}</h2>
            <p>
              {moving ? 'Saving event move...' : `${visibleRange.start.toLocaleDateString()} - ${visibleRange.end.toLocaleDateString()}`}
            </p>
          </div>
          <div className="calendar-legend">
            {Object.entries(EVENT_THEME).map(([key, value]) => (
              <div key={key} className="calendar-legend-item">
                <span className={`calendar-legend-dot ${value.className}`}></span>
                {value.label}
              </div>
            ))}
          </div>
        </div>

        {error ? <div className="status-msg error" style={{ marginBottom: '1rem' }}>{error}</div> : null}

        {loading ? (
          <div className="calendar-skeleton-grid">
            {Array.from({ length: 12 }, (_, index) => (
              <div key={index} className="calendar-skeleton-card"></div>
            ))}
          </div>
        ) : (
          <>
            {view === 'month' ? renderMonthView() : null}
            {view === 'week' ? renderWeekView() : null}
            {view === 'day' ? renderDayView() : null}
          </>
        )}
      </div>

      {tooltip ? (
        <div className="calendar-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.event.title}</strong>
          <span>{EVENT_THEME[tooltip.event.eventType]?.label || 'Event'}</span>
          {getEventDetailLines(tooltip.event).map((line) => (
            <small key={line}>{line}</small>
          ))}
        </div>
      ) : null}

      <CalendarModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
};

export default Calendar;
