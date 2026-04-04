import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './Employee.css';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'leave': return '📅';
      case 'task': return '📋';
      case 'salary': return '💰';
      default: return '🔔';
    }
  };

  return (
    <div className="animate-fade-in employee-page">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-title">Notification Center</h1>
          <p className="dashboard-subtitle">Stay updated with the latest alerts, tasks, and company news.</p>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
           <h3>Recent Activity</h3>
           <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={fetchNotifications}>Refresh</button>
        </div>

        {loading ? (
          <div className="text-center py-10"><div className="spinner"></div></div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-10 text-muted">No notifications yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {notifications.map(notif => (
              <div 
                key={notif._id} 
                className={`glass-panel p-4 ${!notif.isRead ? 'unread-notif' : ''}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1.5rem', 
                  background: !notif.isRead ? 'rgba(79, 70, 229, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                  borderLeft: `4px solid ${!notif.isRead ? 'var(--primary)' : 'transparent'}`,
                  cursor: !notif.isRead ? 'pointer' : 'default'
                }}
                onClick={() => !notif.isRead && markAsRead(notif._id)}
              >
                <div style={{ fontSize: '1.5rem' }}>{getIcon(notif.type)}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.95rem' }}>{notif.message}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(notif.createdAt).toLocaleString()}</span>
                </div>
                {notif.link && (
                  <a href={notif.link} className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>View Details</a>
                )}
                {!notif.isRead && <div className="blink-dot" style={{ background: 'var(--primary)' }}></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
