import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import './Admin.css';

const PendingApprovals = () => {
  const { notifications } = useSocket() || {};
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  const fetchPendingUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/users/pending');
      setUsers(res.data.data);
    } catch (error) {
      setStatusMsg({ type: 'error', text: error.response?.data?.message || 'Failed to load pending approvals.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingUsers();
  }, [fetchPendingUsers]);

  useEffect(() => {
    if (!notifications?.length) return;
    const hasPendingAlert = notifications.some((notification) => notification.link === '/admin/pending-approvals');
    if (hasPendingAlert) {
      fetchPendingUsers();
    }
  }, [notifications, fetchPendingUsers]);

  const handleAction = async (userId, action) => {
    setProcessingId(userId);
    setStatusMsg({ type: '', text: '' });
    try {
      await api.patch(`/auth/users/${action}/${userId}`);
      setUsers((prev) => prev.filter((user) => user._id !== userId));
      setStatusMsg({
        type: 'success',
        text: action === 'approve' ? 'User approved successfully.' : 'User rejected successfully.'
      });
    } catch (error) {
      setStatusMsg({ type: 'error', text: error.response?.data?.message || 'Unable to update approval status.' });
    } finally {
      setProcessingId('');
    }
  };

  return (
    <div className="animate-fade-in admin-page">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Pending Approvals</h1>
          <p className="dashboard-subtitle">Review and approve new user registrations.</p>
        </div>
      </div>

      {statusMsg.text && (
        <div className={`status-msg ${statusMsg.type}`} style={{ marginBottom: '1rem' }}>
          {statusMsg.text}
        </div>
      )}

      <div className="glass-panel p-6">
        <div className="table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-6"><div className="spinner"></div></td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-6 text-muted">No pending approvals at the moment.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id}>
                    <td className="text-main font-medium">{user.name}</td>
                    <td className="text-muted">{user.email}</td>
                    <td className="text-main" style={{ textTransform: 'capitalize' }}>{user.role}</td>
                    <td><span className="badge badge-warning">{user.status}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={processingId === user._id}
                          onClick={() => handleAction(user._id, 'approve')}
                        >
                          {processingId === user._id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={processingId === user._id}
                          onClick={() => handleAction(user._id, 'reject')}
                        >
                          Reject
                        </button>
                      </div>
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

export default PendingApprovals;
