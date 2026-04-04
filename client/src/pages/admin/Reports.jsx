import React, { useState, useEffect } from 'react';
import api, { API_BASE_URL, getApiErrorMessage } from '../../utils/api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './Admin.css';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

const Reports = () => {
  const [data, setData] = useState({ attendance: [], leaves: [] });
  const [loading, setLoading] = useState(true);
  
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const res = await api.get(`/reports/analytics?${queryParams.toString()}`);
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line
  }, []);

  const handleDownload = (type) => {
    const queryParams = new URLSearchParams();
    if (filters.startDate) queryParams.append('startDate', filters.startDate);
    if (filters.endDate) queryParams.append('endDate', filters.endDate);
    
    // Use window.open to trigger the attachment download directly generated from Express
    const token = localStorage.getItem('token');
    
    // Standard link click bypasses Axios so we must manually append auth token if our middleware requires it via query, but wait!
    // If the endpoint is strictly protected, the browser get won't have the Authorization Header.
    // Solution 1: We can just use an authenticated fetch blob method.
    fetch(`${API_BASE_URL}/reports/download/${type}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }).then(res => {
      if(!res.ok) throw new Error('Network response was not ok');
      return res.blob();
    }).then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HRMS_Report_${Date.now()}.${type}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }).catch(err => {
      alert(`Error triggering ${type.toUpperCase()} download: ${getApiErrorMessage(err, 'Download failed')}`);
    });
  };

  return (
    <div className="animate-fade-in admin-page">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Reports & Analytics</h1>
          <p className="dashboard-subtitle">Generate interactive metrics assessing workforce performance curves.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem' }}>
          <button className="btn btn-secondary shadow-hover flex-center gap-2" onClick={() => handleDownload('csv')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Export CSV
          </button>
          <button className="btn btn-primary shadow-hover flex-center gap-2" onClick={() => handleDownload('pdf')}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Export PDF
          </button>
        </div>
      </div>

      <div className="glass-panel p-6" style={{ marginBottom: '2rem' }}>
        <div className="table-controls" style={{ margin: 0 }}>
          <div className="filter-box" style={{ flexGrow: 1, maxWidth: '250px' }}>
             <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Start Date</label>
             <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
          </div>
          <div className="filter-box" style={{ flexGrow: 1, maxWidth: '250px' }}>
             <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>End Date</label>
             <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
          </div>
          <button className="btn btn-primary shadow-hover mt-5" onClick={fetchAnalytics}>
            Apply Filters
          </button>
          <button className="btn btn-secondary mt-5" onClick={() => { setFilters({ startDate: '', endDate: '' }); setTimeout(() => fetchAnalytics(), 100); }}>
            Reset Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-center py-6"><div className="spinner"></div></div>
      ) : (
        <div className="dashboard-bottom-grid">
          {/* Attendance Report */}
          <div className="glass-panel p-6" style={{ minHeight: '350px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>Attendance Distribution</h3>
            {data.attendance.length === 0 ? (
              <p className="text-muted text-center pt-8">No attendance records found for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data.attendance} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label>
                    {data.attendance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-highlight)' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Leave Report */}
          <div className="glass-panel p-6" style={{ minHeight: '350px' }}>
            <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>Leave Status Analytics</h3>
            {data.leaves.length === 0 ? (
              <p className="text-muted text-center pt-8">No leave requests found for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.leaves}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                  <XAxis dataKey="name" stroke="#a1a1aa" />
                  <YAxis stroke="#a1a1aa" allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#ffffff10' }} contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-highlight)' }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]}>
                    {data.leaves.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Reports;
