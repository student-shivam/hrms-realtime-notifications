import React, { useState, useEffect, useCallback } from 'react';
import api, { getApiErrorMessage } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import '../admin/Admin.css';

const AttendanceAdmin = () => {
  const { socket } = useSocket() || {};
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState(() => {
    // Default to today (YYYY-MM-DD format)
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const fetchAttendance = useCallback(async (selectedDate = dateFilter) => {
    setLoading(true);
    setError('');
    try {
      const query = selectedDate ? `?date=${selectedDate}` : '';
      const res = await api.get(`/attendance/live${query}`);
      setLogs(res.data.data);
    } catch (err) {
      console.error('Failed to fetch attendance logs', err);
      setError(getApiErrorMessage(err, 'Failed to fetch attendance logs'));
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleAttendanceUpdate = (payload) => {
      const payloadDate = payload?.date ? new Date(payload.date).toISOString().split('T')[0] : '';
      if (!dateFilter || payloadDate === dateFilter) {
        if (Array.isArray(payload?.snapshot)) {
          setLogs(payload.snapshot);
          setLoading(false);
          return;
        }
      }

      fetchAttendance(dateFilter);
    };

    socket.on('attendance:update', handleAttendanceUpdate);
    socket.on('attendanceUpdate', handleAttendanceUpdate);

    return () => {
      socket.off('attendance:update', handleAttendanceUpdate);
      socket.off('attendanceUpdate', handleAttendanceUpdate);
    };
  }, [socket, dateFilter, fetchAttendance]);

  const getStatusStyles = (status) => {
    if (status === 'Present') {
      return {
        color: '#10b981',
        background: 'rgba(16, 185, 129, 0.14)',
        border: '1px solid rgba(16, 185, 129, 0.28)'
      };
    }

    if (status === 'Checked Out') {
      return {
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.14)',
        border: '1px solid rgba(245, 158, 11, 0.28)'
      };
    }

    return {
      color: '#ef4444',
      background: 'rgba(239, 68, 68, 0.14)',
      border: '1px solid rgba(239, 68, 68, 0.28)'
    };
  };

  const formatTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-fade-in admin-page">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Company Attendance Logs</h1>
          <p className="dashboard-subtitle">Monitor and verify daily employee operations</p>
        </div>
      </div>

      <div className="glass-panel p-6">
        {error && (
          <div className="status-msg error" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}
        <div className="table-controls" style={{ justifyContent: 'flex-start' }}>
          <div className="filter-box" style={{ width: '100%', maxWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Filter by Date
            </label>
            <input 
              type="date" 
              value={dateFilter} 
              onChange={e => setDateFilter(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-highlight)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          <button className="btn btn-secondary mt-5" onClick={() => setDateFilter('')}>
            Clear Filter
          </button>
        </div>

        <div className="table-wrapper mt-4">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center py-6"><div className="spinner"></div></td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-6 text-muted">No attendance activity found for this criteria.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log._id}>
                    <td>
                      <div className="td-user">
                        <div className="avatar-placeholder-sm">{log.employeeName?.charAt(0) || 'U'}</div>
                        <div className="flex flex-col">
                          <span className="font-medium text-main">{log.employeeName || log.employeeId?.name || log.userId?.name || 'Unknown User'}</span>
                          <span className="text-muted" style={{fontSize: '0.8rem'}}>{log.email || log.employeeId?.email || log.userId?.email || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-main">
                      {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="text-muted">
                      {formatTime(log.checkIn)}
                    </td>
                    <td className="text-muted">
                      {formatTime(log.checkOut)}
                    </td>
                    <td className="text-main font-medium">
                      {(log.totalHours || log.workingHours) ? `${log.totalHours || log.workingHours} hrs` : '-'}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={getStatusStyles(log.status)}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AttendanceAdmin;
