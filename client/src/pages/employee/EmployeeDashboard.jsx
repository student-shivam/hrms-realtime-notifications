import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../utils/api';
import './Employee.css';

const EmployeeDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/employee');
      setStats(res.data.data);
    } catch (err) {
      console.error('Failed to fetch employee stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <div className="spinner-container"><div className="spinner"></div></div>;

  const attendance = stats?.attendance || {};
  const leaves = stats?.leaves || {};
  const tasks = stats?.tasks || {};
  const salary = stats?.salary || {};
  const notifications = stats?.notifications || [];

  return (
    <div className="animate-fade-in dashboard-page">
      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-text">
          <h1>Welcome back, {user?.name.split(' ')[0]}!</h1>
          <p>Here's what's happening with your profile today.</p>
        </div>
        <div className="welcome-actions">
           <button 
             className="btn btn-primary shadow-hover"
             onClick={() => navigate('/employee/attendance')}
           >
             {attendance.isAttendanceMarkedToday ? 'View Attendance' : 'Check In Now'}
           </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Today's Status</h3>
          <p className={`stat-value ${attendance.isAttendanceMarkedToday ? 'success' : 'warning'}`} style={{ fontSize: '1.5rem', marginTop: '1rem' }}>
            {attendance.isAttendanceMarkedToday ? 'Checked In' : 'Not Present'}
          </p>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {attendance.todayWorkingHours || 0} hrs logged today
          </p>
        </div>
        <div className="stat-card">
          <h3>Pending Tasks</h3>
          <p className="stat-value primary">{tasks.pendingTasks || 0}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {tasks.completedTasks || 0} completed recently
          </p>
        </div>
        <div className="stat-card">
          <h3>Leave Requests</h3>
          <p className="stat-value warning">{leaves.pendingLeaves || 0}</p>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {leaves.approvedLeaves || 0} approved this month
          </p>
        </div>
        <div className="stat-card">
          <h3>Salary Expected</h3>
          <p className="stat-value success" style={{ fontSize: '2rem' }}>
            ${(salary.base || 0).toLocaleString()}
          </p>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Current base pay
          </p>
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="dashboard-main-grid">
        
        {/* Left Column: Leave Balance & Tasks */}
        <div className="grid-column">
          <div className="glass-panel info-card" style={{ marginBottom: '1.5rem' }}>
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              Leave Balance
            </h2>
            <div className="leave-balance-grid">
              <div className="balance-item">
                <span className="value">{leaves.balance?.sick || 0}</span>
                <span className="label">Sick</span>
              </div>
              <div className="balance-item">
                <span className="value">{leaves.balance?.casual || 0}</span>
                <span className="label">Casual</span>
              </div>
              <div className="balance-item">
                <span className="value">{leaves.balance?.paid || 0}</span>
                <span className="label">Paid</span>
              </div>
            </div>
            <button 
              className="btn btn-secondary mt-6" 
              style={{ width: '100%', fontSize: '0.8rem' }}
              onClick={() => navigate('/employee/leaves')}
            >
              Request Time Off
            </button>
          </div>

          <div className="glass-panel info-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
              Salary Snapshot
            </h2>
            <div className="salary-snapshot">
              <div className="salary-row">
                <span className="text-muted">Base Salary</span>
                <span className="text-main">${(salary.base || 0).toLocaleString()}</span>
              </div>
              <div className="salary-row">
                <span className="text-muted">Housing (HRA)</span>
                <span className="text-main">${(salary.details?.hra || 0).toLocaleString()}</span>
              </div>
              <div className="salary-row">
                <span className="text-muted">Allowances</span>
                <span className="text-main">${(salary.details?.allowances || 0).toLocaleString()}</span>
              </div>
              <div className="salary-total">
                 <span>Total Monthly (Est.)</span>
                 <span>${((salary.base || 0) + (salary.details?.hra || 0) + (salary.details?.allowances || 0)).toLocaleString()}</span>
              </div>
            </div>
            <button 
              className="btn btn-secondary mt-4" 
              style={{ width: '100%', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border-glass)' }}
              onClick={() => navigate('/employee/salary')}
            >
              View Detailed Payslip
            </button>
          </div>
        </div>

        {/* Right Column: Notifications */}
        <div className="grid-column">
          <div className="glass-panel info-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              Recent Activity
            </h2>
            <div className="notification-list">
              {notifications.length === 0 ? (
                <p className="text-muted text-center" style={{ padding: '2rem 0' }}>No recent activity</p>
              ) : (
                notifications.map(notif => (
                  <div key={notif._id} className="notif-mini-card">
                    <p>{notif.message}</p>
                    <span>{new Date(notif.createdAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
            <button 
              className="btn btn-secondary mt-6" 
              style={{ width: '100%', fontSize: '0.8rem' }}
              onClick={() => navigate('/employee/notifications')}
            >
              All Notifications
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeDashboard;
