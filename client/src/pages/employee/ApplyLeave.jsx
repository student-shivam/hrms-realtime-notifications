import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import './ApplyLeave.css';

const ApplyLeave = () => {
  const [formData, setFormData] = useState({
    leaveType: 'Casual',
    fromDate: '',
    toDate: '',
    reason: '',
    documentUrl: ''
  });
  const [totalDays, setTotalDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [balance, setBalance] = useState({ sick: 0, casual: 0, paid: 0 });
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchBalance();
    fetchHistory();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await api.get('/dashboard/employee');
      if (res.data.data.leaves.balance) {
        setBalance(res.data.data.leaves.balance);
      }
    } catch (err) {
      console.error('Failed to fetch balance', err);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/leaves/my');
      setLeaveHistory(res.data.data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (formData.fromDate && formData.toDate) {
      const start = new Date(formData.fromDate);
      const end = new Date(formData.toDate);
      const diffTime = end.getTime() - start.getTime();
      
      if (diffTime >= 0) {
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        setTotalDays(diffDays);
        if (errors.dateRange) setErrors(prev => ({ ...prev, dateRange: null }));
      } else {
        setTotalDays(0);
        setErrors(prev => ({ ...prev, dateRange: 'End date cannot be earlier than start date' }));
      }
    } else {
      setTotalDays(0);
    }
  }, [formData.fromDate, formData.toDate, errors.dateRange]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.leaveType) newErrors.leaveType = 'Please select a leave type';
    if (!formData.fromDate) newErrors.fromDate = 'From Date is required';
    if (!formData.toDate) newErrors.toDate = 'To Date is required';
    if (!formData.reason || formData.reason.trim() === '') newErrors.reason = 'Please provide a reason';
    if (totalDays <= 0) newErrors.dateRange = 'Invalid Date Range';

    // Balance check
    const typeKey = formData.leaveType.toLowerCase();
    if (balance[typeKey] < totalDays) {
      newErrors.leaveType = `Insufficient balance for ${formData.leaveType} (${balance[typeKey]} left)`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await api.post('/leaves', formData);
      showToast('Leave request submitted successfully!', 'success');
      setFormData({ leaveType: 'Casual', fromDate: '', toDate: '', reason: '', documentUrl: '' });
      setTotalDays(0);
      fetchHistory();
      fetchBalance();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to submit request', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in apply-leave-page">
      <div className="leave-layout-grid">
        
        {/* Left Side: Form */}
        <div className="leave-form-container">
          <div className="glass-panel leave-card">
            <div className="leave-header">
              <h2>Apply for Leave</h2>
              <p>Request time off with automated approval tracking.</p>
            </div>

            {toast.show && (
              <div className={`toast-notification ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                {toast.message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="leave-form-group">
                  <label>Leave Type</label>
                  <select name="leaveType" className="leave-input" value={formData.leaveType} onChange={handleChange}>
                    <option value="Casual">Casual Leave</option>
                    <option value="Sick">Sick Leave</option>
                    <option value="Paid">Paid (Privilege) Leave</option>
                  </select>
                  {errors.leaveType && <span className="error-text">{errors.leaveType}</span>}
                </div>

                <div className="leave-form-group">
                   <label>Medical Proof URL (Optional)</label>
                   <input type="text" name="documentUrl" className="leave-input" placeholder="Link to document if Sick Leave" value={formData.documentUrl} onChange={handleChange} />
                </div>
              </div>

              <div className="form-grid">
                <div className="leave-form-group">
                  <label>From Date</label>
                  <input type="date" name="fromDate" className="leave-input" min={getTodayDateString()} value={formData.fromDate} onChange={handleChange} />
                  {errors.fromDate && <span className="error-text">{errors.fromDate}</span>}
                </div>
                <div className="leave-form-group">
                  <label>To Date</label>
                  <input type="date" name="toDate" className="leave-input" min={formData.fromDate || getTodayDateString()} value={formData.toDate} onChange={handleChange} />
                  {errors.toDate && <span className="error-text">{errors.toDate}</span>}
                </div>
              </div>

              {errors.dateRange && <span className="error-text" style={{display: 'block', marginBottom: '1rem', textAlign: 'center'}}>{errors.dateRange}</span>}

              <div className="total-days-display">
                <span>Estimated Duration:</span>
                <strong>{totalDays} {totalDays === 1 ? 'Day' : 'Days'}</strong>
              </div>

              <div className="leave-form-group full-width">
                <label>Reason for Leave</label>
                <textarea name="reason" className="leave-input" placeholder="Please describe the reason for your request..." value={formData.reason} onChange={handleChange} />
                {errors.reason && <span className="error-text">{errors.reason}</span>}
              </div>

              <button type="submit" className="submit-btn" disabled={loading || totalDays === 0}>
                {loading ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Balances & History */}
        <div className="leave-info-container">
          <div className="glass-panel balance-card" style={{ marginBottom: '1.5rem' }}>
            <h3>My Leave Balance</h3>
            <div className="leave-balance-grid mt-4">
              <div className="balance-item">
                <span className="value">{balance.casual}</span>
                <span className="label">Casual</span>
              </div>
              <div className="balance-item">
                <span className="value" style={{color: '#f87171'}}>{balance.sick}</span>
                <span className="label">Sick</span>
              </div>
              <div className="balance-item">
                <span className="value" style={{color: '#60a5fa'}}>{balance.paid}</span>
                <span className="label">Paid</span>
              </div>
            </div>
          </div>

          <div className="glass-panel history-card">
            <h3>Recent Applications</h3>
            <div className="history-list mt-4">
              {historyLoading ? (
                <div className="spinner-container"><div className="spinner small"></div></div>
              ) : leaveHistory.length === 0 ? (
                <p className="text-muted text-center py-4">No history found</p>
              ) : (
                leaveHistory.slice(0, 5).map(leave => (
                  <div key={leave._id} className={`history-item status-${leave.status.toLowerCase()}`}>
                    <div className="item-main">
                      <strong>{leave.leaveType} ({Math.ceil((new Date(leave.toDate) - new Date(leave.fromDate)) / (1000*60*60*24)) + 1} days)</strong>
                      <span>{new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}</span>
                    </div>
                    <div className="item-status">
                      <span className={`badge badge-${leave.status.toLowerCase()}`}>{leave.status}</span>
                    </div>
                    {leave.managerComments && (
                      <div className="manager-note">
                         <small>Note: {leave.managerComments}</small>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ApplyLeave;
