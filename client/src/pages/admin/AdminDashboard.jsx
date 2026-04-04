import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import api, { getApiErrorMessage } from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import './Admin.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const formatTimestamp = (value) => {
  if (!value) return 'Just now';

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  return date.toLocaleDateString();
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#E5E7EB',
        font: {
          family: "'Poppins', sans-serif",
        },
      },
    },
  },
  scales: {
    x: {
      ticks: { color: '#94A3B8' },
      grid: { color: 'rgba(255,255,255,0.04)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#94A3B8', precision: 0 },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#E5E7EB',
        font: {
          family: "'Poppins', sans-serif",
        },
      },
    },
  },
  cutout: '72%',
};

const AdminDashboard = () => {
  const { socket } = useSocket();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

  const fetchStats = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await api.get('/dashboard/stats');
      setStats(res.data.data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load dashboard statistics'));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (!socket) {
      setSocketConnected(false);
      return undefined;
    }

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);
    const handleDashboardUpdate = (payload) => {
      if (payload?.stats) {
        setStats(payload.stats);
        setError('');
        setLoading(false);
      }
    };

    setSocketConnected(Boolean(socket.connected));
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('dashboardUpdate', handleDashboardUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('dashboardUpdate', handleDashboardUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (socketConnected) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      fetchStats(true);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [socketConnected]);

  if (loading) {
    return (
      <div className="admin-dashboard-container animate-fade-in">
        <div className="spinner-container"><div className="spinner"></div></div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="admin-dashboard-container animate-fade-in">
        <div className="glass-panel p-6 text-center">
          <h2 className="dashboard-title" style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>Dashboard Unavailable</h2>
          <p className="dashboard-subtitle" style={{ marginBottom: '1.25rem' }}>{error}</p>
          <button className="btn btn-primary shadow-hover" onClick={() => fetchStats()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const monthlyAttendance = stats?.monthlyAttendance || [];
  const lastSevenDays = stats?.lastSevenDays || [];
  const recentActivity = stats?.recentActivity || [];
  const todayBreakdown = stats?.todayBreakdown || [];

  const monthlyAttendanceData = {
    labels: monthlyAttendance.map((item) => item.label),
    datasets: [
      {
        label: 'Checked In',
        data: monthlyAttendance.map((item) => item.checkedIn),
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99, 102, 241, 0.18)',
        fill: true,
        tension: 0.38,
      },
      {
        label: 'Checked Out',
        data: monthlyAttendance.map((item) => item.checkedOut),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        tension: 0.34,
      },
    ],
  };

  const weeklyData = {
    labels: lastSevenDays.map((item) => item.label),
    datasets: [
      {
        label: 'Present',
        data: lastSevenDays.map((item) => item.present),
        backgroundColor: '#6366F1',
        borderRadius: 10,
      },
      {
        label: 'Checked Out',
        data: lastSevenDays.map((item) => item.checkedOut),
        backgroundColor: '#10B981',
        borderRadius: 10,
      },
      {
        label: 'On Leave',
        data: lastSevenDays.map((item) => item.leave),
        backgroundColor: '#F59E0B',
        borderRadius: 10,
      },
      {
        label: 'Absent',
        data: lastSevenDays.map((item) => item.absent),
        backgroundColor: '#EF4444',
        borderRadius: 10,
      },
    ],
  };

  const todayAttendanceData = {
    labels: todayBreakdown.map((item) => item.label),
    datasets: [
      {
        data: todayBreakdown.map((item) => item.value),
        backgroundColor: ['#6366F1', '#10B981', '#F59E0B', '#EF4444'],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const cards = [
    {
      label: 'Total Employees',
      value: stats?.totalEmployees || 0,
      icon: 'fas fa-users',
      iconClass: 'bg-primary-glow',
      trend: `${stats?.totalDepartments || 0} active departments`,
    },
    {
      label: 'Present Today',
      value: stats?.presentToday || 0,
      icon: 'fas fa-user-check',
      iconClass: 'bg-success-glow',
      trend: `${stats?.activeAttendanceToday || 0} active attendance records`,
    },
    {
      label: 'Checked Out',
      value: stats?.checkedOutToday || 0,
      icon: 'fas fa-clock',
      iconClass: 'bg-warning-glow',
      trend: 'Completed daily attendance',
    },
    {
      label: 'Absent Today',
      value: stats?.absentToday || 0,
      icon: 'fas fa-user-times',
      iconClass: 'bg-secondary-glow',
      trend: 'Not checked in yet',
    },
    {
      label: 'On Leave',
      value: stats?.leaveCount || 0,
      icon: 'fas fa-calendar-minus',
      iconClass: 'bg-warning-glow',
      trend: 'Approved leave overlaps today',
    },
    {
      label: 'Departments',
      value: stats?.totalDepartments || 0,
      icon: 'fas fa-building',
      iconClass: 'bg-primary-glow',
      trend: socketConnected ? 'Live socket connected' : 'Auto-refresh every 30s',
    },
  ];

  return (
    <div className="admin-dashboard-container animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard Overview</h1>
          <p className="dashboard-subtitle">
            Real-time operational view powered by live database metrics.
          </p>
        </div>
        <div className="dashboard-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
          <span className={`badge ${socketConnected ? 'badge-success' : 'badge-warning'}`}>
            {socketConnected ? 'Live Connected' : 'Polling Fallback'}
          </span>
          <button className="btn btn-primary shadow-hover" onClick={() => fetchStats(true)}>
            Refresh Now
          </button>
        </div>
      </div>

      {error ? (
        <div className="status-msg error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      ) : null}

      <div className="metric-cards-grid">
        {cards.map((card) => (
          <div className="metric-card glass-panel" key={card.label}>
            <div className={`metric-icon ${card.iconClass}`}>
              <i className={card.icon}></i>
            </div>
            <div className="metric-content">
              <p className="metric-label">{card.label}</p>
              <h2 className="metric-value">{card.value}</h2>
              <span className="metric-trend">{card.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-main-grid">
        <div className="chart-container glass-panel">
          <h3>Monthly Attendance Trend</h3>
          <div className="chart-wrapper">
            <Line data={monthlyAttendanceData} options={chartOptions} />
          </div>
        </div>

        <div className="chart-container glass-panel">
          <h3>Today's Attendance</h3>
          <div className="chart-wrapper">
            <Doughnut data={todayAttendanceData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      <div className="dashboard-bottom-grid">
        <div className="recent-activity-panel glass-panel">
          <div className="panel-header">
            <h3>Recent Activity</h3>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>
              Updated {formatTimestamp(stats?.generatedAt)}
            </span>
          </div>

          <ul className="activity-list">
            {recentActivity.length ? recentActivity.map((activity) => (
              <li className="activity-item" key={activity.id}>
                <div className={`activity-indicator bg-${activity.color}`}></div>
                <div className="activity-details">
                  <p className="activity-text">{activity.title}</p>
                  <span className="activity-time">{formatTimestamp(activity.timestamp)}</span>
                </div>
              </li>
            )) : (
              <li className="activity-item">
                <div className="activity-details">
                  <p className="activity-text">No recent activity found.</p>
                </div>
              </li>
            )}
          </ul>
        </div>

        <div className="chart-container glass-panel">
          <h3>Last 7 Days Overview</h3>
          <div className="chart-wrapper">
            <Bar
              data={weeklyData}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: {
                    position: 'top',
                    labels: {
                      color: '#E5E7EB',
                      boxWidth: 12,
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
