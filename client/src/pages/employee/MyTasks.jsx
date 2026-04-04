import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import './Employee.css';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [fileInput, setFileInput] = useState({ id: null, url: '' });
  const { notifications } = useSocket() || {};

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data.data);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (notifications && notifications.length > 0) {
      if (notifications[0].type === 'task') {
        fetchTasks();
      }
    }
  }, [notifications]);

  const handleStatusUpdate = async (id, newStatus, fileUrl = null) => {
    setUpdating(id);
    try {
      await api.put(`/tasks/${id}/status`, { status: newStatus, fileUrl });
      fetchTasks();
      setFileInput({ id: null, url: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setUpdating(null);
    }
  };

  const getDeadlineInfo = (deadline) => {
    if (!deadline) return { text: 'No Deadline', class: '' };
    const date = new Date(deadline);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diff = date - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { text: `Overdue by ${Math.abs(days)}d`, class: 'deadline-overdue' };
    if (days === 0) return { text: 'Due Today', class: 'deadline-near' };
    if (days <= 3) return { text: `Due in ${days}d`, class: 'deadline-near' };
    return { text: `Due: ${date.toLocaleDateString()}`, class: 'deadline-safe' };
  };

  const getStatusBadge = (status) => {
    if (status === 'Completed') return 'badge-success';
    if (status === 'In Progress') return 'badge-primary';
    return 'badge-warning';
  };

  return (
    <div className="animate-fade-in employee-page">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="dashboard-title">Mission Control / Tasks</h1>
          <p className="dashboard-subtitle">Manage your active assignments and deliverables.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem' }}>
        {loading ? (
          <div className="spinner-container"><div className="spinner"></div></div>
        ) : tasks.length === 0 ? (
          <div className="glass-panel p-10 text-muted text-center" style={{ gridColumn: '1 / -1' }}>
             <h3>All clear!</h3>
             <p>No tasks currently assigned to you.</p>
          </div>
        ) : (
          tasks.map(task => {
            const deadlineInfo = getDeadlineInfo(task.deadline);
            return (
              <div key={task._id} className="glass-panel p-6" style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1.25rem', 
                position: 'relative',
                borderLeft: `5px solid ${task.status === 'Completed' ? '#10b981' : task.status === 'In Progress' ? '#3b82f6' : '#f59e0b'}` 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'white', margin: 0 }}>{task.title}</h3>
                  <span className={`badge ${getStatusBadge(task.status)}`}>{task.status}</span>
                </div>
                
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', flexGrow: 1, margin: 0, lineHeight: '1.5' }}>
                  {task.description}
                </p>

                {task.deadline && (
                  <div className={`task-deadline ${deadlineInfo.class}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    {deadlineInfo.text}
                  </div>
                )}

                {task.fileUrl && (
                  <div className="task-file-section">
                    <a href={task.fileUrl} target="_blank" rel="noopener noreferrer" className="task-file-link">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                      View Attached File
                    </a>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem' }}>
                  {task.status !== 'Completed' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {fileInput.id === task._id ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="leave-input" 
                            placeholder="Enter delivery file URL..." 
                            style={{ fontSize: '0.8rem' }}
                            value={fileInput.url}
                            onChange={(e) => setFileInput({ ...fileInput, url: e.target.value })}
                          />
                          <button 
                            className="btn btn-primary" 
                            style={{ background: 'var(--success)', whiteSpace: 'nowrap' }}
                            onClick={() => handleStatusUpdate(task._id, 'Completed', fileInput.url)}
                          >
                            Submit
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          {task.status === 'Pending' && (
                            <button 
                              className="btn btn-primary shadow-hover" 
                              style={{ flex: 1 }}
                              disabled={updating === task._id}
                              onClick={() => handleStatusUpdate(task._id, 'In Progress')}
                            >
                              {updating === task._id ? 'Starting...' : 'Start Work'}
                            </button>
                          )}
                          {task.status === 'In Progress' && (
                            <button 
                              className="btn btn-secondary shadow-hover" 
                              style={{ flex: 1, background: 'var(--success)', color: 'white', border: 'none' }}
                              disabled={updating === task._id}
                              onClick={() => setFileInput({ id: task._id, url: '' })}
                            >
                              Finalize Task
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {task.status === 'Completed' && (
                    <div style={{ textAlign: 'center', color: 'var(--success)', fontSize: '0.85rem', fontWeight: '600' }}>
                      ✓ Task officially completed
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MyTasks;
