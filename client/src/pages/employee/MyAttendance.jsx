import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api, { getApiErrorMessage } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import './Employee.css';

const MyAttendance = () => {
  const { socket } = useSocket() || {};
  const { user } = useSelector((state) => state.auth);
  const [history, setHistory] = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [btnLoading, setBtnLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Modal states
  const [showReport, setShowReport] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTodayStatus = async () => {
    try {
      const res = await api.get('/attendance/today');
      setAttendance(res.data.data);
    } catch (err) {
      console.error('Failed to fetch today status', err);
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to fetch today attendance') });
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get('/attendance');
      setHistory(res.data.data);
    } catch (err) {
      console.error('Failed to fetch attendance history', err);
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to fetch attendance history') });
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    setReportLoading(true);
    setShowReport(true);
    try {
      const res = await api.get('/attendance/report');
      setReportData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch report', err);
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to fetch attendance report') });
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayStatus();
    fetchHistory();
  }, []);

  const currentUserId = user?._id || user?.id || '';

  useEffect(() => {
    if (!socket) return undefined;

    const handleAttendanceUpdate = (payload) => {
      if (!payload?.attendance) return;
      setAttendance(payload.attendance);
      fetchHistory();
    };

    socket.on('attendance:self:update', handleAttendanceUpdate);

    const handleGlobalAttendanceUpdate = (payload) => {
      const record = payload?.record;
      if (!record) return;
      const currentUserId = String(record.userId || '');

      if (currentUserId && String(currentUserId) === String(user?._id || user?.id || '')) {
        setAttendance(record);
        fetchHistory();
      }
    };

    socket.on('attendanceUpdate', handleGlobalAttendanceUpdate);

    return () => {
      socket.off('attendance:self:update', handleAttendanceUpdate);
      socket.off('attendanceUpdate', handleGlobalAttendanceUpdate);
    };
  }, [socket, user, currentUserId]);

  const handleMarkAttendance = async () => {
    if (attendance?.checkIn && attendance?.checkOut) return;

    setBtnLoading(true);
    setStatusMsg({ type: '', text: 'Requesting location...' });
    
    let location = null;
    
    if ("geolocation" in navigator) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      } catch (geoError) {
        console.warn("Geolocation failed or denied:", geoError);
        setStatusMsg({ type: 'warning', text: 'Location access denied. Marking without GPS.' });
      }
    }

    try {
      const endpoint = !attendance || !attendance.checkIn ? '/attendance/checkin' : '/attendance/checkout';
      const res = await api.post(endpoint, { location });

      setAttendance(res.data.data);
      setStatusMsg({ 
        type: 'success', 
        text: !attendance ? 'Checked in successfully!' : 'Checked out successfully!' 
      });
      fetchHistory();
    } catch (err) {
      setStatusMsg({ 
        type: 'error', 
        text: getApiErrorMessage(err, 'Error processing attendance')
      });
    } finally {
      setBtnLoading(false);
    }
  };

  const getButtonText = () => {
    if (btnLoading) return 'Processing...';
    if (!attendance) return 'Check In';
    if (attendance && !attendance.checkOut) return 'Check Out';
    return 'Completed';
  };

  const getButtonStyle = () => {
    if (!attendance) return { background: 'var(--primary)' };
    if (attendance && !attendance.checkOut) return { background: 'var(--warning)' };
    return { background: 'var(--text-muted)', cursor: 'not-allowed' };
  };

  const formatDuration = (ms) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
      .map(v => v < 10 ? "0" + v : v)
      .join(":");
  };

  const calculateHours = () => {
    if (!attendance || !attendance.checkIn) return "00:00:00";
    const start = new Date(attendance.checkIn);
    const end = attendance.checkOut ? new Date(attendance.checkOut) : currentTime;
    return formatDuration(end - start);
  };

  const getStatusInfo = () => {
    if (!attendance) return { text: 'Not Checked In', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
    if (!attendance.checkOut) return { text: 'Currently Working', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', blink: true };
    return { text: 'Day Completed', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
  };

  const status = getStatusInfo();
  const formatTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="animate-fade-in employee-page">
      <div className="glass-panel p-6" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-heading)', margin: 0 }}>Daily Attendance</h2>
            <span style={{ 
              padding: '0.25rem 0.75rem', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: '600',
              background: status.bg,
              color: status.color,
              border: `1px solid ${status.color}44`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              {status.blink && <span className="blink-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: status.color }}></span>}
              {status.text}
            </span>
          </div>
          <p className="text-muted">Clock in your attendance for today. Late logins and early logouts are monitored.</p>
          <button className="btn btn-secondary mt-2" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={fetchMonthlyReport}>
            Detailed Monthly Report
          </button>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button 
            className="btn btn-primary shadow-hover" 
            onClick={handleMarkAttendance} 
            disabled={btnLoading || (attendance?.checkIn && attendance?.checkOut)}
            style={{ 
              padding: '0.75rem 2rem', 
              fontSize: '1rem', 
              fontWeight: '600',
              minWidth: '150px',
              ...getButtonStyle()
            }}
          >
            {getButtonText()}
          </button>
          
          {(attendance?.checkIn || attendance?.checkOut) && (
            <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '0.5rem' }}>
                <span className={attendance.isLate ? 'text-warning' : ''}>In: <strong>{formatTime(attendance.checkIn)}</strong> {attendance.isLate && '(Late)'}</span>
                {attendance.checkOut && <span className={attendance.isEarlyLogout ? 'text-warning' : ''}>Out: <strong>{formatTime(attendance.checkOut)}</strong> {attendance.isEarlyLogout && '(Early)'}</span>}
              </div>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: !attendance.checkOut ? '#3b82f6' : '#10b981',
                fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                {calculateHours()}
              </div>
            </div>
          )}
        </div>
      </div>

      {statusMsg.text && (
        <div className={`status-msg ${statusMsg.type}`} style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
          {statusMsg.text}
        </div>
      )}

      <div className="glass-panel p-6">
        <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>Attendance History</h3>
        
        <div className="table-wrapper">
          <table className="modern-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Working Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner"></div></td></tr>
              ) : history.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No records found.</td></tr>
              ) : (
                history.map(record => (
                  <tr key={record._id}>
                    <td>
                      {new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      {formatTime(record.checkIn)}
                      {record.isLate && <span className="badge badge-warning ml-2" style={{fontSize: '0.65rem', padding: '2px 6px'}}>LATE</span>}
                    </td>
                    <td>
                      {formatTime(record.checkOut)}
                      {record.isEarlyLogout && <span className="badge badge-warning ml-2" style={{fontSize: '0.65rem', padding: '2px 6px'}}>EARLY</span>}
                    </td>
                    <td>{(record.totalHours || record.workingHours) ? `${record.totalHours || record.workingHours} hrs` : '-'}</td>
                    <td>
                      <span className={`badge ${record.status === 'Present' ? 'badge-success' : record.status === 'Checked Out' ? 'badge-warning' : 'badge-danger'}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Report Modal */}
      {showReport && (
        <div className="modal-overlay" onClick={() => setShowReport(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', position: 'relative' }}>
            <button className="close-btn" style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', outline: 'none' }} onClick={() => setShowReport(false)}>×</button>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '2rem' }}>Monthly Performance Summary</h2>
            
            {reportLoading ? (
               <div className="text-center py-10"><div className="spinner"></div></div>
            ) : (
              <div className="report-content">
                <div className="report-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <div className="balance-item">
                    <span className="label">Days Worked</span>
                    <span className="value">{reportData.length}</span>
                  </div>
                  <div className="balance-item">
                     <span className="label">Avg Daily Hours</span>
                     <span className="value">{(reportData.reduce((s,r) => s + (r.workingHours || 0), 0) / (reportData.length || 1)).toFixed(1)}h</span>
                  </div>
                  <div className="balance-item">
                     <span className="label">Late Arrivals</span>
                     <span className="value" style={{color: '#f59e0b'}}>{reportData.filter(r => r.isLate).length}</span>
                  </div>
                  <div className="balance-item">
                     <span className="label">Early Logouts</span>
                     <span className="value" style={{color: '#f59e0b'}}>{reportData.filter(r => r.isEarlyLogout).length}</span>
                  </div>
                </div>
                
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Detailed Audit Log</h3>
                <div className="table-wrapper">
                  <table className="modern-table small" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Hours</th>
                        <th>Late</th>
                        <th>Early</th>
                        <th>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map(r => (
                        <tr key={r._id}>
                          <td>{new Date(r.date).toLocaleDateString()}</td>
                          <td>{r.workingHours || 0}h</td>
                          <td style={{ color: r.isLate ? '#f59e0b' : 'inherit' }}>{r.isLate ? 'YES' : 'NO'}</td>
                          <td style={{ color: r.isEarlyLogout ? '#f59e0b' : 'inherit' }}>{r.isEarlyLogout ? 'YES' : 'NO'}</td>
                          <td style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {r.location ? `${r.location.lat.toFixed(2)}, ${r.location.lng.toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendance;
