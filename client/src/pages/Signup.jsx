import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser, clearError, clearSuccessMessage } from '../store/slices/authSlice';
import './Auth.css';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'employee'
  });
  const dispatch = useDispatch();
  const { loading, error, successMessage } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  useEffect(() => {
    dispatch(clearError());
    dispatch(clearSuccessMessage());
  }, [dispatch]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const resultAction = await dispatch(registerUser(formData));
    
    if (registerUser.fulfilled.match(resultAction)) {
      setFormData({
        name: '', email: '', password: '', role: 'employee'
      });
      setTimeout(() => navigate('/login'), 1200);
    }
  };

  return (
    <div className="auth-container animate-fade-in">
      <div className="glass-panel auth-card">
        <h2 className="auth-title">Create Account</h2>
        <p className="auth-subtitle">Join the HRMS platform</p>
        
        {error && <div className="auth-error">{error}</div>}
        {successMessage && <div className="status-msg success" style={{ marginBottom: '1rem' }}>{successMessage}</div>}

        <form onSubmit={handleSubmit} className="auth-form flex flex-col gap-4">
          <div className="form-group">
            <label>Full Name</label>
            <input name="name" type="text" required value={formData.name} onChange={handleChange} placeholder="John Doe" disabled={loading} />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="name@company.com" disabled={loading} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input name="password" type="password" required value={formData.password} onChange={handleChange} placeholder="Min 6 characters" minLength="6" disabled={loading} />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select name="role" value={formData.role} onChange={handleChange} disabled={loading}>
              <option value="employee">Employee</option>
              <option value="admin">System Admin</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary mt-2" disabled={loading}>
            {loading ? 'Signing Up...' : 'Sign Up'}
          </button>
        </form>
        <p className="auth-footer mt-4">
          Already have an account? <Link to="/login">Sign in here</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
