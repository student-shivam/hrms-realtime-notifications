import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';
import './Admin.css';

const Employees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', department: '', salary: '' });
  const [formStatus, setFormStatus] = useState({ type: '', message: '' });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/employees?page=${page}&limit=10&keyword=${keyword}&department=${department}`);
      setEmployees(res.data.data);
      setTotalPages(res.data.pagination.pages);
      setTotalCount(res.data.pagination.total);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line
  }, [page, keyword, department]);

  const handleSearch = (e) => setKeyword(e.target.value);
  const handleFilter = (e) => setDepartment(e.target.value);

  const openModal = (emp = null) => {
    setFormStatus({ type: '', message: '' });
    if (emp) {
      setEditingEmp(emp);
      setFormData({ name: emp.name, email: emp.email, department: emp.department, salary: emp.salary });
    } else {
      setEditingEmp(null);
      setFormData({ name: '', email: '', department: '', salary: '' });
    }
    setShowModal(true);
  };

  const saveEmployee = async (e) => {
    e.preventDefault();
    setFormStatus({ type: 'loading', message: 'Saving...' });

    try {
      if (editingEmp) {
        await api.put(`/employees/${editingEmp._id}`, formData);
        setFormStatus({ type: 'success', message: 'Employee updated successfully!' });
      } else {
        await api.post('/employees', formData);
        setFormStatus({ type: 'success', message: 'Employee added successfully!' });
      }
      fetchEmployees();
      setTimeout(() => setShowModal(false), 1500);
    } catch (err) {
      setFormStatus({ type: 'error', message: err.response?.data?.message || 'Error saving employee' });
    }
  };

  const deleteEmployee = async (id) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="animate-fade-in employees-page">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">Employee Directory</h1>
          <p className="dashboard-subtitle">Manage all {totalCount} employees</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn btn-primary shadow-hover" onClick={() => openModal()}>
            + Add Employee
          </button>
        </div>
      </div>

      <div className="glass-panel p-6">
        <div className="table-controls">
          <div className="search-box">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              value={keyword} 
              onChange={handleSearch} 
            />
          </div>
          <div className="filter-box">
            <select value={department} onChange={handleFilter}>
              <option value="">All Departments</option>
              <option value="Engineering">Engineering</option>
              <option value="HR">HR</option>
              <option value="Marketing">Marketing</option>
              <option value="Sales">Sales</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Salary</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="text-center py-6"><div className="spinner"></div></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-6 text-muted">No employees found.</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp._id}>
                    <td>
                      <div className="td-user">
                        <div className="avatar-placeholder-sm">{emp.name.charAt(0)}</div>
                        <span className="font-medium text-main">{emp.name}</span>
                      </div>
                    </td>
                    <td className="text-muted">{emp.email}</td>
                    <td>
                      <span className="badge badge-primary">{emp.department}</span>
                    </td>
                    <td className="text-main">${emp.salary?.toLocaleString()}</td>
                    <td className="text-right">
                      <button className="icon-btn" onClick={() => emp.linkedUserId && navigate(`/admin/profile/${emp.linkedUserId}`)} title="View Profile" disabled={!emp.linkedUserId}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </button>
                      <button className="icon-btn btn-edit" onClick={() => openModal(emp)} title="Edit">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      </button>
                      <button className="icon-btn btn-delete" onClick={() => deleteEmployee(emp._id)} title="Delete">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn-page" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="page-info">Page {page} of {totalPages}</span>
            <button className="btn-page" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container glass-panel animate-fade-in">
            <div className="modal-header">
              <h3>{editingEmp ? 'Edit Employee' : 'Add New Employee'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={saveEmployee} className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@company.com" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <select required value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                    <option value="">Select Dept</option>
                    <option value="Engineering">Engineering</option>
                    <option value="HR">HR</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Sales">Sales</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Annual Salary ($)</label>
                  <input required type="number" min="0" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} placeholder="60000" />
                </div>
              </div>

              {formStatus.message && (
                <div className={`status-msg ${formStatus.type}`}>
                  {formStatus.message}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary shadow-hover" disabled={formStatus.type === 'loading'}>
                  {formStatus.type === 'loading' ? 'Saving...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
