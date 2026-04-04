import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import api, { API_BASE_URL, ASSET_BASE_URL, getApiErrorMessage } from '../../utils/api';
import { setUser } from '../../store/slices/authSlice';
import '../admin/Admin.css';

const tabs = ['About', 'Skills', 'Experience', 'Documents', 'Performance'];

const starLabel = (rating) => Array.from({ length: 5 }, (_, index) => (
  <span key={index} style={{ color: index < rating ? '#fbbf24' : 'rgba(255,255,255,0.18)', fontSize: '1.1rem' }}>★</span>
));

const formatDate = (value) => {
  if (!value) return 'Present';
  return new Date(value).toLocaleDateString([], { month: 'short', year: 'numeric' });
};

const Profile = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { user: authUser } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('About');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [experienceForm, setExperienceForm] = useState({
    company: '',
    role: '',
    startDate: '',
    endDate: '',
    description: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    bio: '',
    rating: 0,
    attendancePercentage: 0,
    taskCompletion: 0,
    adminNotes: ''
  });
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState('');

  const isOwnProfile = !id || String(id) === String(authUser?._id || authUser?.id);
  const canEdit = Boolean(profile) && (isOwnProfile || authUser?.role === 'admin');
  const isAdminView = authUser?.role === 'admin';

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const endpoint = id ? `/profile/${id}` : '/profile/me';
      const res = await api.get(endpoint);
      const nextProfile = res.data.data;
      setProfile(nextProfile);
      setEditForm({
        name: nextProfile.name || '',
        email: nextProfile.email || '',
        phone: nextProfile.phone || '',
        designation: nextProfile.designation || '',
        department: nextProfile.department || '',
        bio: nextProfile.bio || '',
        rating: nextProfile.performance?.rating || 0,
        attendancePercentage: nextProfile.performance?.attendancePercentage || 0,
        taskCompletion: nextProfile.performance?.taskCompletion || 0,
        adminNotes: nextProfile.performance?.notes || ''
      });
      setProfileImagePreview(nextProfile.profileImage ? `${ASSET_BASE_URL}${nextProfile.profileImage}` : '');
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load profile'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const handleProfileSave = async (event) => {
    event.preventDefault();
    try {
      setStatusMsg({ type: 'loading', text: 'Saving profile...' });
      const formData = new FormData();
      const payload = isOwnProfile ? {} : { userId: profile._id };

      Object.entries(editForm).forEach(([key, value]) => {
        if (value !== '' && value !== null && typeof value !== 'undefined') {
          payload[key] = value;
        }
      });

      const skills = Array.isArray(profile?.skills) ? profile.skills : [];
      payload.skills = skills.join(',');

      Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
      if (profileImageFile) {
        formData.append('profileImage', profileImageFile);
      }

      const res = await api.put('/profile/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (isOwnProfile) {
        dispatch(setUser(res.data.data));
      }
      setStatusMsg({ type: 'success', text: 'Profile updated successfully.' });
      setProfileImageFile(null);
      fetchProfile();
    } catch (err) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to update profile') });
    }
  };

  const handleAddSkill = () => {
    const skill = selectedSkill.trim();
    if (!skill) return;
    setProfile((prev) => ({
      ...prev,
      skills: Array.from(new Set([...(prev?.skills || []), skill]))
    }));
    setSelectedSkill('');
  };

  const handleRemoveSkill = (skill) => {
    setProfile((prev) => ({
      ...prev,
      skills: (prev?.skills || []).filter((item) => item !== skill)
    }));
  };

  const handleSaveSkills = async () => {
    try {
      setStatusMsg({ type: 'loading', text: 'Saving skills...' });
      await api.put('/profile/update', {
        userId: profile._id,
        skills: profile.skills
      });
      setStatusMsg({ type: 'success', text: 'Skills updated.' });
      fetchProfile();
    } catch (err) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to save skills') });
    }
  };

  const handleExperienceSubmit = async (event) => {
    event.preventDefault();
    try {
      setStatusMsg({ type: 'loading', text: 'Adding experience...' });
      await api.post('/profile/add-experience', {
        userId: profile._id,
        ...experienceForm
      });
      setExperienceForm({ company: '', role: '', startDate: '', endDate: '', description: '' });
      setStatusMsg({ type: 'success', text: 'Experience added.' });
      fetchProfile();
    } catch (err) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to add experience') });
    }
  };

  const handleDeleteExperience = async (experienceId) => {
    try {
      await api.delete(`/profile/delete-experience/${experienceId}?userId=${profile._id}`);
      fetchProfile();
    } catch (err) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Failed to remove experience') });
    }
  };

  const handleProtectedDocument = async (path, downloadName = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL.replace(/\/api$/, '')}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error('Unable to access document');
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;

      if (downloadName) {
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
      }

      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 2000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: getApiErrorMessage(err, 'Unable to open document') });
    }
  };

  const handleProfileImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfileImageFile(file);
    setProfileImagePreview(URL.createObjectURL(file));
  };

  const completionTone = useMemo(() => {
    if ((profile?.profileCompletion || 0) >= 80) return 'var(--success)';
    if ((profile?.profileCompletion || 0) >= 50) return 'var(--warning)';
    return 'var(--secondary)';
  }, [profile?.profileCompletion]);

  if (loading) {
    return <div className="spinner-container"><div className="spinner"></div></div>;
  }

  if (error || !profile) {
    return (
      <div className="glass-panel p-6 text-center">
        <h2 className="dashboard-title" style={{ fontSize: '1.5rem' }}>Profile Unavailable</h2>
        <p className="dashboard-subtitle" style={{ marginBottom: '1rem' }}>{error || 'Profile not found'}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in admin-page profile-shell" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title">{isOwnProfile ? 'My Profile' : 'Employee Profile'}</h1>
          <p className="dashboard-subtitle">Professional HRMS profile with skills, experience, documents, and performance.</p>
        </div>
        {!isOwnProfile && isAdminView ? (
          <Link to="/admin/employees" className="btn btn-secondary">Back to Employees</Link>
        ) : null}
      </div>

      <div className="profile-grid">
        <div className="glass-panel p-6 profile-sidebar-card">
          <div className="profile-hero">
            <div className="profile-avatar-wrap">
              {profileImagePreview ? (
                <img src={profileImagePreview} alt={profile.name} className="profile-avatar-lg" />
              ) : (
                <div className="profile-avatar-fallback">{profile.name?.charAt(0) || 'U'}</div>
              )}
            </div>
            <div className="profile-hero-copy">
              <h2>{profile.name}</h2>
              <p>{profile.designation || profile.role}</p>
              <span>{profile.department || 'Department not assigned'}</span>
            </div>
          </div>

          <div className="profile-meta-list">
            <div><strong>Email</strong><span>{profile.email}</span></div>
            <div><strong>Phone</strong><span>{profile.phone || 'Not added'}</span></div>
            <div><strong>Role</strong><span>{profile.role}</span></div>
            <div><strong>Last Updated</strong><span>{new Date(profile.updatedAt).toLocaleDateString()}</span></div>
          </div>

          <div className="profile-completion-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong>Profile Completion</strong>
              <span>{profile.profileCompletion}%</span>
            </div>
            <div style={{ width: '100%', height: '10px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${profile.profileCompletion}%`, background: completionTone, height: '100%' }}></div>
            </div>
          </div>

          {canEdit ? (
            <form onSubmit={handleProfileSave} className="profile-edit-form">
              <div className="form-group">
                <label>Profile Photo</label>
                <input type="file" accept="image/*" onChange={handleProfileImageChange} />
              </div>

              {(isOwnProfile || isAdminView) ? (
                <>
                  {isAdminView ? (
                    <>
                      <div className="form-group">
                        <label>Full Name</label>
                        <input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} />
                      </div>
                    </>
                  ) : null}

                  <div className="form-group">
                    <label>Designation</label>
                    <input value={editForm.designation} onChange={(e) => setEditForm((prev) => ({ ...prev, designation: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <input value={editForm.department} onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))} disabled={!isAdminView && !isOwnProfile} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Bio</label>
                    <textarea rows="4" value={editForm.bio} onChange={(e) => setEditForm((prev) => ({ ...prev, bio: e.target.value }))}></textarea>
                  </div>
                </>
              ) : null}

              {isAdminView ? (
                <div className="profile-admin-box">
                  <h4>Performance Input</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Rating</label>
                      <input type="number" min="0" max="5" step="0.1" value={editForm.rating} onChange={(e) => setEditForm((prev) => ({ ...prev, rating: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Attendance %</label>
                      <input type="number" min="0" max="100" step="0.1" value={editForm.attendancePercentage} onChange={(e) => setEditForm((prev) => ({ ...prev, attendancePercentage: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Task Completion %</label>
                    <input type="number" min="0" max="100" step="0.1" value={editForm.taskCompletion} onChange={(e) => setEditForm((prev) => ({ ...prev, taskCompletion: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Admin Notes</label>
                    <textarea rows="4" value={editForm.adminNotes} onChange={(e) => setEditForm((prev) => ({ ...prev, adminNotes: e.target.value }))}></textarea>
                  </div>
                </div>
              ) : null}

              {statusMsg.text ? <div className={`status-msg ${statusMsg.type}`}>{statusMsg.text}</div> : null}

              <button type="submit" className="btn btn-primary shadow-hover">
                Save Profile
              </button>
            </form>
          ) : null}
        </div>

        <div className="profile-content-col">
          <div className="glass-panel p-6 profile-tabs-card">
            <div className="profile-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`profile-tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'About' ? (
              <div className="profile-section-card">
                <h3>About</h3>
                <p>{profile.bio || 'No bio added yet.'}</p>
              </div>
            ) : null}

            {activeTab === 'Skills' ? (
              <div className="profile-section-card">
                <div className="profile-section-header">
                  <h3>Skills</h3>
                  {canEdit ? (
                    <div className="profile-inline-actions">
                      <input value={selectedSkill} onChange={(e) => setSelectedSkill(e.target.value)} placeholder="Add skill" />
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddSkill}>Add</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveSkills}>Save</button>
                    </div>
                  ) : null}
                </div>
                <div className="profile-skill-list">
                  {(profile.skills || []).length ? profile.skills.map((skill) => (
                    <span key={skill} className="profile-skill-tag">
                      {skill}
                      {canEdit ? <button type="button" onClick={() => handleRemoveSkill(skill)}>×</button> : null}
                    </span>
                  )) : <p className="text-muted">No skills added yet.</p>}
                </div>
              </div>
            ) : null}

            {activeTab === 'Experience' ? (
              <div className="profile-section-card">
                <div className="profile-section-header">
                  <h3>Experience</h3>
                </div>

                <div className="profile-experience-list">
                  {(profile.experience || []).length ? profile.experience.map((item) => (
                    <div key={item._id} className="profile-exp-card">
                      <div className="profile-exp-line"></div>
                      <div className="profile-exp-body">
                        <h4>{item.role}</h4>
                        <strong>{item.company}</strong>
                        <span>{formatDate(item.startDate)} - {formatDate(item.endDate)}</span>
                        <p>{item.description || 'No description provided.'}</p>
                        {canEdit ? <button type="button" className="btn-link" onClick={() => handleDeleteExperience(item._id)}>Remove</button> : null}
                      </div>
                    </div>
                  )) : <p className="text-muted">No experience entries yet.</p>}
                </div>

                {canEdit ? (
                  <form className="profile-experience-form" onSubmit={handleExperienceSubmit}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Company</label>
                        <input value={experienceForm.company} onChange={(e) => setExperienceForm((prev) => ({ ...prev, company: e.target.value }))} required />
                      </div>
                      <div className="form-group">
                        <label>Role</label>
                        <input value={experienceForm.role} onChange={(e) => setExperienceForm((prev) => ({ ...prev, role: e.target.value }))} required />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Date</label>
                        <input type="date" value={experienceForm.startDate} onChange={(e) => setExperienceForm((prev) => ({ ...prev, startDate: e.target.value }))} required />
                      </div>
                      <div className="form-group">
                        <label>End Date</label>
                        <input type="date" value={experienceForm.endDate} onChange={(e) => setExperienceForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea rows="4" value={experienceForm.description} onChange={(e) => setExperienceForm((prev) => ({ ...prev, description: e.target.value }))}></textarea>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm">Add Experience</button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'Documents' ? (
              <div className="profile-section-card">
                <h3>Documents</h3>
                <div className="profile-document-grid">
                  {(profile.documents || []).length ? profile.documents.map((doc) => (
                    <div key={doc._id} className="profile-doc-card">
                      <strong>{doc.displayName}</strong>
                      <span>{doc.documentType}</span>
                      <small>{new Date(doc.createdAt).toLocaleDateString()}</small>
                      <div className="profile-doc-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleProtectedDocument(doc.previewUrl)}>View</button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleProtectedDocument(doc.downloadUrl, doc.originalName || `${doc.displayName}.pdf`)}>Download</button>
                      </div>
                    </div>
                  )) : <p className="text-muted">No documents uploaded.</p>}
                </div>
              </div>
            ) : null}

            {activeTab === 'Performance' ? (
              <div className="profile-section-card">
                <div className="profile-performance-grid">
                  <div className="profile-performance-card">
                    <span>Rating</span>
                    <strong>{Number(profile.performance?.rating || 0).toFixed(1)}</strong>
                    <div>{starLabel(Math.round(profile.performance?.rating || 0))}</div>
                  </div>
                  <div className="profile-performance-card">
                    <span>Attendance</span>
                    <strong>{profile.performance?.attendancePercentage || 0}%</strong>
                  </div>
                  <div className="profile-performance-card">
                    <span>Task Completion</span>
                    <strong>{profile.performance?.taskCompletion || 0}%</strong>
                  </div>
                </div>
                <div className="profile-admin-note">
                  <h4>Admin Notes</h4>
                  <p>{profile.performance?.notes || 'No performance notes yet.'}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
